import { type FormEvent, type ReactElement, useEffect, useRef, useState } from "react";
import type {
	PiAuthenticationEvent,
	PiAuthenticationMethod,
	PiAuthenticationStatus,
} from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@view/components/ui/dialog";
import {
	respondPiAuthenticationPrompt,
	subscribeToPiAuthenticationEvents,
} from "@view/lib/pi-client";
import { AuthenticationStep } from "./AuthenticationStep";
import { ProviderList } from "./ProviderList";
import type { ActiveLogin } from "./types";

type ProviderAuthenticationDialogProps = {
	authentication?: PiAuthenticationStatus[];
	onCancel: (provider: string) => Promise<void>;
	onLogin: (provider: string, method: PiAuthenticationMethod) => Promise<void>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

export function ProviderAuthenticationDialog({
	authentication,
	onCancel,
	onLogin,
	onOpenChange,
	open,
}: ProviderAuthenticationDialogProps): ReactElement {
	const [activeLogin, setActiveLogin] = useState<ActiveLogin>();
	const [error, setError] = useState<string>();
	const [promptValue, setPromptValue] = useState("");
	const activeProviderRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		function handleAuthenticationEvent(event: PiAuthenticationEvent): void {
			if (event.provider !== activeProviderRef.current) return;
			setPromptValue("");
			setActiveLogin((current) => current ? { ...current, event } : current);
		}

		return subscribeToPiAuthenticationEvents(handleAuthenticationEvent);
	}, []);

	function reset(): void {
		activeProviderRef.current = undefined;
		setActiveLogin(undefined);
		setError(undefined);
		setPromptValue("");
	}

	async function handleLogin(
		provider: PiAuthenticationStatus,
		method: PiAuthenticationMethod,
	): Promise<void> {
		setError(undefined);
		setPromptValue("");
		activeProviderRef.current = provider.provider;
		setActiveLogin({ event: undefined, provider, status: "active" });
		try {
			await onLogin(provider.provider, method);
			setActiveLogin((current) => current ? { ...current, status: "complete" } : current);
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法完成提供商登录。"));
		}
	}

	async function handlePromptSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const prompt = activeLogin?.event;
		if (!prompt?.promptId || prompt.inputType === "select") return;
		setError(undefined);
		try {
			await respondPiAuthenticationPrompt({ id: prompt.promptId, value: promptValue });
			setPromptValue("");
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法提交登录输入。"));
		}
	}

	async function handleSelect(optionId: string): Promise<void> {
		const prompt = activeLogin?.event;
		if (!prompt?.promptId) return;
		setError(undefined);
		try {
			await respondPiAuthenticationPrompt({ id: prompt.promptId, value: optionId });
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法提交登录选项。"));
		}
	}

	async function handleReturnToProviders(): Promise<void> {
		if (activeLogin) await onCancel(activeLogin.provider.provider);
		reset();
	}

	async function handleOpenChange(nextOpen: boolean): Promise<void> {
		if (nextOpen) {
			onOpenChange(true);
			return;
		}
		if (activeLogin?.status === "active") {
			try {
				await onCancel(activeLogin.provider.provider);
			} catch (requestError) {
				setError(toErrorMessage(requestError, "无法取消登录。"));
				return;
			}
		}
		reset();
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => void handleOpenChange(nextOpen)}>
			<DialogContent className="flex max-h-[min(42rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
				<DialogHeader className="shrink-0 px-4 pt-4 pb-2 border-b">
					<DialogTitle>{activeLogin ? `${activeLogin.provider.name} 登录` : "连接模型提供商"}</DialogTitle>
					<DialogDescription>
						{activeLogin
							? "完成授权后，当前会话会自动刷新可用模型。"
							: "连接任一提供商后，即可向 Pi 发送消息。"}
					</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
					{activeLogin ? (
						<AuthenticationStep
							error={error}
							login={activeLogin}
							onPromptSubmit={handlePromptSubmit}
							onReturnToProviders={handleReturnToProviders}
							onSelect={handleSelect}
							promptValue={promptValue}
							setPromptValue={setPromptValue}
						/>
					) : (
						<ProviderList authentication={authentication} onLogin={handleLogin} />
					)}
				</div>
				<DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-4 py-2">
					<Button onClick={() => void handleOpenChange(false)} type="button" variant="outline">
						{activeLogin?.status === "active" ? "取消登录" : "关闭"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}


function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
