import { CheckCircle2, Copy, ExternalLink, LoaderCircle } from "lucide-react";
import { type FormEvent, type ReactElement, useState } from "react";
import type { PiAuthenticationEvent } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import type { ActiveLogin } from "./types";

type AuthenticationStepProps = {
	error?: string;
	login: ActiveLogin;
	onPromptSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
	onReturnToProviders: () => Promise<void>;
	onSelect: (optionId: string) => Promise<void>;
	promptValue: string;
	setPromptValue: (value: string) => void;
};

export function AuthenticationStep({
	error,
	login,
	onPromptSubmit,
	onReturnToProviders,
	onSelect,
	promptValue,
	setPromptValue,
}: AuthenticationStepProps): ReactElement {
	const event = login.event;
	if (login.status === "complete") {
		return (
			<p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm" role="status">
				<CheckCircle2 aria-hidden className="size-4 text-primary" />
				{login.provider.name} 已连接，当前会话的可用模型已刷新。
			</p>
		);
	}
	return (
		<div className="grid min-h-28 gap-3">
			{!event ? <LoadingState providerName={login.provider.name} /> : null}
			{event?.type === "auth_url" ? <BrowserAuthorization event={event} /> : null}
			{event?.type === "device_code" ? <DeviceCodeAuthorization event={event} /> : null}
			{event?.type === "prompt" ? (
				<AuthenticationPrompt
					event={event}
					onPromptSubmit={onPromptSubmit}
					onSelect={onSelect}
					promptValue={promptValue}
					setPromptValue={setPromptValue}
				/>
			) : null}
			{event?.type === "info" || event?.type === "progress" ? (
				<p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground" role="status">
					{event.message}
				</p>
			) : null}
			{error ? (
				<div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
					<p className="text-sm text-destructive" role="alert">{error}</p>
					<Button onClick={() => void onReturnToProviders()} size="sm" type="button" variant="outline">
						选择其他提供商
					</Button>
				</div>
			) : null}
		</div>
	);
}

function LoadingState({ providerName }: { providerName: string }): ReactElement {
	return (
		<p className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground" role="status">
			<LoaderCircle aria-hidden className="size-4 animate-spin" />
			正在启动 {providerName} 登录…
		</p>
	);
}

function BrowserAuthorization({ event }: { event: PiAuthenticationEvent }): ReactElement {
	if (!event.url) return <p className="text-sm text-destructive" role="alert">提供商未返回授权地址。</p>;
	return (
		<div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
			<p className="text-sm">{event.message ?? "浏览器已打开，请完成授权。"}</p>
			<Button asChild size="sm" type="button" variant="outline">
				<a href={event.url} rel="noreferrer" target="_blank">
					<ExternalLink aria-hidden />
					再次打开浏览器
				</a>
			</Button>
		</div>
	);
}

function DeviceCodeAuthorization({ event }: { event: PiAuthenticationEvent }): ReactElement {
	const [copied, setCopied] = useState(false);
	if (!event.url || !event.userCode) return <p className="text-sm text-destructive" role="alert">提供商未返回设备码。</p>;

	async function copyCode(): Promise<void> {
		try {
			await navigator.clipboard.writeText(event.userCode!);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
			<p className="text-sm">{event.message ?? "在浏览器中输入设备代码以完成授权。"}</p>
			<div className="flex items-center gap-2">
				<code className="min-w-0 flex-1 rounded-md bg-background px-3 py-2 text-center text-base font-medium tracking-[0.2em]">{event.userCode}</code>
				<Button onClick={() => void copyCode()} size="sm" type="button" variant="outline">
					<Copy aria-hidden />
					{copied ? "已复制" : "复制"}
				</Button>
			</div>
			<Button asChild size="sm" type="button" variant="outline">
				<a href={event.url} rel="noreferrer" target="_blank">
					<ExternalLink aria-hidden />
					打开验证页面
				</a>
			</Button>
		</div>
	);
}

type AuthenticationPromptProps = {
	event: PiAuthenticationEvent;
	onPromptSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
	onSelect: (optionId: string) => Promise<void>;
	promptValue: string;
	setPromptValue: (value: string) => void;
};

function AuthenticationPrompt({
	event,
	onPromptSubmit,
	onSelect,
	promptValue,
	setPromptValue,
}: AuthenticationPromptProps): ReactElement {
	if (!event.promptId || !event.inputType) return <p className="text-sm text-destructive" role="alert">登录输入请求无效。</p>;
	if (event.inputType === "select") {
		return (
			<div className="grid gap-2">
				<p className="text-sm font-medium">{event.message}</p>
				{event.options.map((option) => (
					<Button key={option.id} onClick={() => void onSelect(option.id)} type="button" variant="outline">
						{option.label}
					</Button>
				))}
			</div>
		);
	}
	const inputType = event.inputType === "secret" ? "password" : "text";
	return (
		<form className="grid gap-3" onSubmit={(formEvent) => void onPromptSubmit(formEvent)}>
			<label className="grid gap-1.5 text-sm font-medium">
				{event.message}
				<input
					autoFocus
					className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					onChange={(changeEvent) => setPromptValue(changeEvent.target.value)}
					placeholder={event.placeholder ?? undefined}
					type={inputType}
					value={promptValue}
				/>
			</label>
			<Button disabled={!promptValue} size="sm" type="submit">继续</Button>
		</form>
	);
}
