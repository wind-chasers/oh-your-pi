import type { AuthPrompt } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
	PiAuthenticationCancelRequestSchema,
	PiAuthenticationEventSchema,
	PiAuthenticationLoginRequestSchema,
	PiAuthenticationPromptResponseSchema,
	type PiAuthenticationEvent,
	type PiAuthenticationLoginRequest,
	type PiAuthenticationPromptResponse,
} from "@shared/pi-contract";

type AuthenticationEvent =
	| { type: "auth_url"; url: string; instructions?: string }
	| { type: "device_code"; userCode: string; verificationUri: string }
	| { type: "info"; message: string }
	| { type: "progress"; message: string };

export class PiAuthenticationController {
	private readonly providerAbortControllers = new Map<string, AbortController>();
	private readonly pendingPrompts = new Map<string, {
		provider: string;
		reject: (error: Error) => void;
		resolve: (value: string) => void;
	}>();
	private readonly providerOperations = new Map<string, Promise<void>>();
	private eventHandler: ((event: PiAuthenticationEvent) => void) | undefined;

	setEventHandler(eventHandler: (event: PiAuthenticationEvent) => void): void {
		this.eventHandler = eventHandler;
	}

	async loginProvider(input: PiAuthenticationLoginRequest, modelRuntime: ModelRuntime): Promise<void> {
		const request = PiAuthenticationLoginRequestSchema.parse(input);
		await this.withProviderOperation(request.provider, async () => {
			const provider = modelRuntime.getProvider(request.provider);
			const method = request.authType === "oauth" ? provider?.auth.oauth : provider?.auth.apiKey;
			if (!method?.login) throw new Error("该提供商不支持所选的登录方式。");
			const abortController = new AbortController();
			this.providerAbortControllers.set(request.provider, abortController);
			try {
				await modelRuntime.login(request.provider, request.authType, {
					signal: abortController.signal,
					prompt: async (prompt) => this.requestPrompt(request.provider, prompt),
					notify: (event) => this.emitEvent(request.provider, event),
				});
			} finally {
				if (this.providerAbortControllers.get(request.provider) === abortController)
					this.providerAbortControllers.delete(request.provider);
			}
		});
	}

	cancelProviderLogin(provider: string): void {
		PiAuthenticationCancelRequestSchema.parse({ provider });
		this.providerAbortControllers.get(provider)?.abort();
		for (const [id, prompt] of this.pendingPrompts) {
			if (prompt.provider !== provider) continue;
			this.pendingPrompts.delete(id);
			prompt.reject(new Error("登录已取消。"));
		}
	}

	respondPrompt(input: PiAuthenticationPromptResponse): void {
		const response = PiAuthenticationPromptResponseSchema.parse(input);
		const prompt = this.pendingPrompts.get(response.id);
		if (!prompt) throw new Error("该登录输入请求已失效。");
		this.pendingPrompts.delete(response.id);
		prompt.resolve(response.value);
	}

	async withProviderOperation<T>(provider: string, operation: () => Promise<T>): Promise<T> {
		const previous = this.providerOperations.get(provider) ?? Promise.resolve();
		const { promise: completed, resolve: release } = Promise.withResolvers<void>();
		const current = previous.catch(() => undefined).then(() => completed);
		this.providerOperations.set(provider, current);
		await previous.catch(() => undefined);
		try {
			return await operation();
		} finally {
			release();
			if (this.providerOperations.get(provider) === current) this.providerOperations.delete(provider);
		}
	}

	reset(): void {
		for (const prompt of this.pendingPrompts.values()) prompt.reject(new Error("登录已取消。"));
		this.pendingPrompts.clear();
		for (const abortController of this.providerAbortControllers.values()) abortController.abort();
		this.providerAbortControllers.clear();
	}

	private emitEvent(provider: string, event: AuthenticationEvent): void {
		let value: {
			message: string;
			url: string | null;
			userCode: string | null;
			promptId: string | null;
			placeholder: string | null;
			inputType: null;
			options: [];
		};
		switch (event.type) {
			case "auth_url":
				value = {
					message: event.instructions ?? "请在浏览器中继续授权。",
					url: event.url,
					userCode: null,
					promptId: null,
					placeholder: null,
					inputType: null,
					options: [],
				};
				break;
			case "device_code":
				value = {
					message: "在浏览器中输入设备代码以完成授权。",
					url: event.verificationUri,
					userCode: event.userCode,
					promptId: null,
					placeholder: null,
					inputType: null,
					options: [],
				};
				break;
			default:
				value = { message: event.message, url: null, userCode: null, promptId: null, placeholder: null, inputType: null, options: [] };
		}
		this.eventHandler?.(PiAuthenticationEventSchema.parse({ provider, type: event.type, ...value }));
	}

	private requestPrompt(provider: string, prompt: AuthPrompt): Promise<string> {
		const id = crypto.randomUUID();
		this.eventHandler?.(
			PiAuthenticationEventSchema.parse({
				provider,
				type: "prompt",
				message: prompt.message,
				url: null,
				userCode: null,
				promptId: id,
				placeholder: "placeholder" in prompt ? prompt.placeholder ?? null : null,
				inputType: prompt.type,
				options: prompt.type === "select" ? prompt.options.map((option) => ({ id: option.id, label: option.label })) : [],
			}),
		);
		const { promise, resolve, reject } = Promise.withResolvers<string>();
		this.pendingPrompts.set(id, { provider, reject, resolve });
		prompt.signal?.addEventListener("abort", () => {
			const pendingPrompt = this.pendingPrompts.get(id);
			if (!pendingPrompt) return;
			this.pendingPrompts.delete(id);
			pendingPrompt.reject(new Error("登录输入已取消。"));
		}, { once: true });
		return promise;
	}
}
