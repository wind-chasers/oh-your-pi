import type {
	PiAuthenticationCancelRequest,
	PiAuthenticationEvent,
	PiAuthenticationLoginRequest,
	PiAuthenticationPromptResponse,
	PiAuthenticationStatus,
} from "@shared/pi-contract";
import type {
	PiAuthentication,
	PiAuthenticationEvent as PiSdkAuthenticationEvent,
	PiAuthenticationPrompt,
} from "@main/pi";

type AuthenticationListener = (event: PiAuthenticationEvent) => void;

type PendingPrompt = {
	provider: string;
	reject(error: Error): void;
	resolve(value: string): void;
};

export class AuthenticationApplication {
	private disposed = false;
	private readonly listeners = new Set<AuthenticationListener>();
	private readonly pendingPrompts = new Map<string, PendingPrompt>();
	private readonly providerAbortControllers = new Map<string, AbortController>();
	private readonly providerOperations = new Map<string, Promise<void>>();

	constructor(private readonly authentication: PiAuthentication) {}

	async list(): Promise<PiAuthenticationStatus[]> {
		return this.authentication.listProviders();
	}

	async login(input: PiAuthenticationLoginRequest): Promise<void> {
		this.requireActive();
		await this.withProviderOperation(input.provider, async () => {
			const abortController = new AbortController();
			this.providerAbortControllers.set(input.provider, abortController);
			try {
				await this.authentication.login(input.provider, input.authType, {
					signal: abortController.signal,
					notify: (event) => this.emitAuthenticationEvent(input.provider, event),
					prompt: (prompt) => this.requestPrompt(input.provider, prompt),
				});
			} finally {
				if (this.providerAbortControllers.get(input.provider) === abortController) {
					this.providerAbortControllers.delete(input.provider);
				}
			}
		});
	}

	cancel(input: PiAuthenticationCancelRequest): void {
		this.providerAbortControllers.get(input.provider)?.abort();
		for (const [id, prompt] of this.pendingPrompts) {
			if (prompt.provider !== input.provider) continue;
			this.pendingPrompts.delete(id);
			prompt.reject(new Error("登录已取消。"));
		}
	}

	respond(input: PiAuthenticationPromptResponse): void {
		const prompt = this.pendingPrompts.get(input.id);
		if (!prompt) throw new Error("该登录输入请求已失效。");
		this.pendingPrompts.delete(input.id);
		prompt.resolve(input.value);
	}

	async withProviderOperation<T>(provider: string, operation: () => Promise<T>): Promise<T> {
		this.requireActive();
		const previous = this.providerOperations.get(provider) ?? Promise.resolve();
		const { promise: completed, resolve: release } = Promise.withResolvers<void>();
		const current = previous.catch(() => undefined).then(() => completed);
		this.providerOperations.set(provider, current);
		await previous.catch(() => undefined);
		this.requireActive();
		try {
			return await operation();
		} finally {
			release();
			if (this.providerOperations.get(provider) === current) this.providerOperations.delete(provider);
		}
	}

	subscribe(listener: AuthenticationListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const prompt of this.pendingPrompts.values()) prompt.reject(new Error("登录已取消。"));
		this.pendingPrompts.clear();
		for (const abortController of this.providerAbortControllers.values()) abortController.abort();
		this.providerAbortControllers.clear();
		this.listeners.clear();
	}

	private emitAuthenticationEvent(provider: string, event: PiSdkAuthenticationEvent): void {
		let applicationEvent: PiAuthenticationEvent;
		switch (event.type) {
			case "auth-url":
				applicationEvent = {
					provider,
					type: "auth_url",
					message: event.instructions ?? "请在浏览器中继续授权。",
					url: event.url,
					userCode: null,
					promptId: null,
					placeholder: null,
					inputType: null,
					options: [],
				};
				break;
			case "device-code":
				applicationEvent = {
					provider,
					type: "device_code",
					message: "在浏览器中输入设备代码以完成授权。",
					url: event.verificationUrl,
					userCode: event.userCode,
					promptId: null,
					placeholder: null,
					inputType: null,
					options: [],
				};
				break;
			case "info":
			case "progress":
				applicationEvent = {
					provider,
					type: event.type,
					message: event.message,
					url: null,
					userCode: null,
					promptId: null,
					placeholder: null,
					inputType: null,
					options: [],
				};
				break;
		}
		this.emit(applicationEvent);
	}

	private requestPrompt(provider: string, prompt: PiAuthenticationPrompt): Promise<string> {
		const id = crypto.randomUUID();
		this.emit({
			provider,
			type: "prompt",
			message: prompt.message,
			url: null,
			userCode: null,
			promptId: id,
			placeholder: prompt.placeholder ?? null,
			inputType: prompt.type,
			options: prompt.options,
		});
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

	private emit(event: PiAuthenticationEvent): void {
		for (const listener of this.listeners) listener(event);
	}

	private requireActive(): void {
		if (this.disposed) throw new Error("认证服务已经关闭。");
	}
}
