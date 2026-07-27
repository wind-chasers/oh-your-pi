import type { AuthPrompt } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

export type PiProviderStatus = {
	provider: string;
	name: string;
	status: "available" | "unavailable" | "unknown";
	type: "oauth" | "api_key" | null;
	loginMethods: Array<"oauth" | "api_key">;
};

export type PiAuthenticationPromptOption = {
	id: string;
	label: string;
};

export type PiAuthenticationPrompt = {
	type: "text" | "secret" | "manual_code" | "select";
	message: string;
	placeholder?: string;
	options: PiAuthenticationPromptOption[];
	signal?: AbortSignal;
};

export type PiAuthenticationEvent =
	| { type: "auth-url"; url: string; instructions?: string }
	| { type: "device-code"; userCode: string; verificationUrl: string }
	| { type: "info"; message: string }
	| { type: "progress"; message: string };

export type PiAuthenticationInteraction = {
	signal?: AbortSignal;
	notify(event: PiAuthenticationEvent): void;
	prompt(prompt: PiAuthenticationPrompt): Promise<string>;
};

export class PiAuthentication {
	constructor(private readonly modelRuntime: ModelRuntime) {}

	async listProviders(): Promise<PiProviderStatus[]> {
		return Promise.all(this.modelRuntime.getProviders().map(async (provider) => {
			const loginMethods: PiProviderStatus["loginMethods"] = [];
			if (provider.auth.oauth?.login) loginMethods.push("oauth");
			if (provider.auth.apiKey?.login) loginMethods.push("api_key");
			try {
				const auth = await this.modelRuntime.checkAuth(provider.id);
				return {
					provider: provider.id,
					name: provider.name,
					status: auth ? "available" as const : "unavailable" as const,
					type: auth?.type ?? null,
					loginMethods,
				};
			} catch {
				return {
					provider: provider.id,
					name: provider.name,
					status: "unknown" as const,
					type: null,
					loginMethods,
				};
			}
		}));
	}

	async login(
		providerId: string,
		method: "oauth" | "api_key",
		interaction: PiAuthenticationInteraction,
	): Promise<void> {
		const provider = this.modelRuntime.getProvider(providerId);
		const authentication = method === "oauth" ? provider?.auth.oauth : provider?.auth.apiKey;
		if (!authentication?.login) throw new Error("该提供商不支持所选的登录方式。");

		await this.modelRuntime.login(providerId, method, {
			signal: interaction.signal,
			notify: (event) => interaction.notify(toAuthenticationEvent(event)),
			prompt: (prompt) => interaction.prompt(toAuthenticationPrompt(prompt)),
		});
	}
}

function toAuthenticationEvent(event: {
	type: string;
	url?: string;
	instructions?: string;
	userCode?: string;
	verificationUri?: string;
	message?: string;
}): PiAuthenticationEvent {
	switch (event.type) {
		case "auth_url":
			if (!event.url) throw new Error("Pi 认证事件缺少授权 URL。");
			return { type: "auth-url", url: event.url, instructions: event.instructions };
		case "device_code":
			if (!event.userCode || !event.verificationUri) throw new Error("Pi 认证事件缺少设备代码。");
			return { type: "device-code", userCode: event.userCode, verificationUrl: event.verificationUri };
		case "info":
			return { type: "info", message: event.message ?? "" };
		case "progress":
			return { type: "progress", message: event.message ?? "" };
		default:
			throw new Error(`不支持的 Pi 认证事件：${event.type}`);
	}
}

function toAuthenticationPrompt(prompt: AuthPrompt): PiAuthenticationPrompt {
	return {
		type: prompt.type,
		message: prompt.message,
		placeholder: "placeholder" in prompt ? prompt.placeholder : undefined,
		options: prompt.type === "select"
			? prompt.options.map((option) => ({ id: option.id, label: option.label }))
			: [],
		signal: prompt.signal,
	};
}
