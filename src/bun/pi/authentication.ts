import type { AuthInteraction, AuthType } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { PiAuthenticationStatus } from "@shared/pi-contract";

export class PiAuthentication {
	constructor(private readonly modelRuntime: ModelRuntime) {}

	async listProviders(): Promise<PiAuthenticationStatus[]> {
		return Promise.all(this.modelRuntime.getProviders().map(async (provider) => {
			const loginMethods: AuthType[] = [];
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
		method: AuthType,
		interaction: AuthInteraction,
	): Promise<void> {
		const provider = this.modelRuntime.getProvider(providerId);
		const authentication = method === "oauth" ? provider?.auth.oauth : provider?.auth.apiKey;
		if (!authentication?.login) throw new Error("该提供商不支持所选的登录方式。");
		await this.modelRuntime.login(providerId, method, interaction);
	}
}
