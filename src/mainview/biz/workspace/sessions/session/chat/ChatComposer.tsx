import { LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { type FormEvent, type ReactElement } from "react";
import { Button } from "@view/components/ui/button";
import { AuthenticationDialogOpenAtom } from "@view/states/authentication.atom";
import { ModelThinkingSelector } from "./ModelThinkingSelector";

type ChatComposerProps = {
	draft: string;
	error?: string;
	hasAvailableCredential: boolean;
	hasAvailableModel: boolean;
	isSending: boolean;
	isStreaming: boolean;
	onChange: (value: string) => void;
	onFollowUp: () => Promise<void>;
	onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function ChatComposer({
	draft,
	error,
	hasAvailableCredential,
	hasAvailableModel,
	isSending,
	isStreaming,
	onChange,
	onFollowUp,
	onSubmit,
}: ChatComposerProps): ReactElement {
	const setAuthenticationOpen = AuthenticationDialogOpenAtom.useChange();
	const canCompose = hasAvailableCredential && hasAvailableModel;

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
		if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
		event.preventDefault();
		event.currentTarget.form?.requestSubmit();
	}

	return (
		<div className="bg-background px-5 pb-4 pt-2">
			<form className="mx-auto max-w-3xl" onSubmit={(event) => void onSubmit(event)}>
				<div className="rounded-2xl border bg-muted/20 p-3 focus-within:ring-2 focus-within:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-50">
					<textarea
						aria-label="发送给 Pi 的消息"
						className="block min-h-lh max-h-[8lh] w-full field-sizing-content resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
						disabled={isSending || !canCompose}
						onChange={(event) => onChange(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={hasAvailableCredential ? (isStreaming ? "发送新指令以打断当前任务…" : "告诉 Pi 你想完成什么…") : "连接模型提供商后即可开始对话…"}
						rows={1}
						value={draft}
					/>
				</div>
				<div className="mt-2 flex items-center justify-between gap-3 px-0.5">
					<div className="flex gap-2">
						<ModelThinkingSelector />
					</div>
					<div className="flex gap-2 items-center">
						{!hasAvailableCredential ? (
							<Button onClick={() => setAuthenticationOpen(true)} size="sm" type="button">
								<ShieldCheck aria-hidden />
								连接模型提供商
							</Button>
						) : (
							<>
								{isStreaming ? (
									<Button
										disabled={isSending || draft.trim() === ""}
										onClick={() => void onFollowUp()}
										size="sm"
										type="button"
										variant="outline"
									>
										排队后续
									</Button>
								) : null}
								<p className="text-xs text-muted-foreground">⌘/Ctrl + Enter 发送</p>
								<Button
									disabled={isSending || !hasAvailableModel || draft.trim() === ""}
									size="sm"
									type="submit"
								>
									{isSending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
									{isStreaming ? "插入指令" : "发送"}
								</Button>
							</>
						)}
					</div>
				</div>
			</form>
			{error ? <p className="mx-auto mt-3 max-w-3xl text-sm text-destructive" role="alert">{error}</p> : null}
		</div>
	);
}
