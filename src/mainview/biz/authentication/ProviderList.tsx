import { CheckCircle2, CircleDashed, KeyRound, LoaderCircle, LogIn } from "lucide-react";
import { type ReactElement } from "react";
import type { PiAuthenticationMethod, PiAuthenticationStatus } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import type { ProviderLoginHandler } from "./types";

type ProviderListProps = {
	authentication?: PiAuthenticationStatus[];
	onLogin: ProviderLoginHandler;
};

export function ProviderList({ authentication, onLogin }: ProviderListProps): ReactElement {
	if (!authentication) return <ProviderLoadingState />;
	const loginProviders = authentication.filter((provider) => provider.loginMethods.length > 0);
	if (loginProviders.length === 0) {
		return (
			<p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
				当前 Pi 配置中没有可在应用内登录的提供商。请检查 Pi 的模型或环境变量配置。
			</p>
		);
	}
	const oauthProviders = loginProviders.filter((provider) => provider.loginMethods.includes("oauth"));
	const apiKeyProviders = loginProviders.filter((provider) => !provider.loginMethods.includes("oauth"));
	return (
		<div className="space-y-6">
			<ProviderSection
				description="使用订阅账号或浏览器授权连接。"
				onLogin={onLogin}
				providers={oauthProviders}
				title="OAuth 登录"
			/>
			<ProviderSection
				description="使用 API Key 或 provider 的交互配置。"
				onLogin={onLogin}
				providers={apiKeyProviders}
				title="API Key"
			/>
		</div>
	);
}

type ProviderSectionProps = {
	description: string;
	onLogin: ProviderLoginHandler;
	providers: PiAuthenticationStatus[];
	title: string;
};

function ProviderSection({ description, onLogin, providers, title }: ProviderSectionProps): ReactElement | null {
	if (providers.length === 0) return null;
	return (
		<section>
			<div className="mb-2">
				<h3 className="text-sm font-medium">{title}</h3>
				<p className="mt-1 text-xs text-muted-foreground">{description}</p>
			</div>
			<div className="divide-y rounded-lg border">
				{providers.map((provider) => <ProviderRow key={provider.provider} onLogin={onLogin} provider={provider} />)}
			</div>
		</section>
	);
}

type ProviderRowProps = {
	onLogin: ProviderLoginHandler;
	provider: PiAuthenticationStatus;
};

function ProviderRow({ onLogin, provider }: ProviderRowProps): ReactElement {
	const connected = provider.status === "available";
	return (
		<div className="flex items-center gap-3 p-3">
			{connected ? (
				<CheckCircle2 aria-hidden className="size-4 shrink-0 text-primary" />
			) : (
				<CircleDashed aria-hidden className="size-4 shrink-0 text-muted-foreground" />
			)}
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{provider.name}</p>
				<p className="text-xs text-muted-foreground">{providerStatusLabel(provider.status)}</p>
			</div>
			<div className="flex shrink-0 gap-2">
				{provider.loginMethods.map((method) => (
					<Button
						key={method}
						onClick={() => void onLogin(provider, method)}
						size="sm"
						type="button"
						variant={method === "oauth" ? "default" : "outline"}
					>
						{method === "oauth" ? <LogIn aria-hidden /> : <KeyRound aria-hidden />}
						{loginActionLabel(method, connected)}
					</Button>
				))}
			</div>
		</div>
	);
}

function ProviderLoadingState(): ReactElement {
	return (
		<p className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground" role="status">
			<LoaderCircle aria-hidden className="size-4 animate-spin" />
			正在读取可用的模型提供商…
		</p>
	);
}

function providerStatusLabel(status: PiAuthenticationStatus["status"]): string {
	if (status === "available") return "已连接";
	if (status === "unknown") return "状态未知";
	return "未连接";
}

function loginActionLabel(method: PiAuthenticationMethod, connected: boolean): string {
	if (method === "oauth") return connected ? "重新登录" : "OAuth 登录";
	return connected ? "重新配置" : "配置 API Key";
}
