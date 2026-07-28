import { type FormEvent, type ReactElement, useState } from "react";
import type { PiImageAttachment, PiOpenedSession } from "@shared/pi-contract";
import type { ChatSession } from "@view/chat-store";
import { AuthenticationAtom } from "@view/states/authentication.atom";
import { ComposerAttachments } from "./ComposerAttachments";
import { ComposerToolbar } from "./ComposerToolbar";
import { useComposerAttachments } from "./use-composer-attachments";

type ChatComposerProps = {
	error?: string;
	isSending: boolean;
	openedSession: PiOpenedSession;
	session: ChatSession;
};

export function ChatComposer({
	error,
	isSending,
	openedSession,
	session,
}: ChatComposerProps): ReactElement {
	const [draft, setDraft] = useState("");
	const [attachments, setAttachments] = useState<PiImageAttachment[]>([]);
	const authentication = AuthenticationAtom.useData() ?? [];
	const attachmentState = useComposerAttachments({
		attachments,
		onChange: setAttachments,
	});
	const isStreaming = openedSession.runtime.isStreaming;
	const selectedModel = openedSession.runtime.model;
	const hasAvailableCredential = authentication.some((provider) => provider.status === "available");
	const hasAvailableModel =
		selectedModel !== undefined &&
		authentication.some(
			(provider) =>
				provider.provider === selectedModel.provider && provider.status === "available",
		);
	const canCompose = hasAvailableCredential && hasAvailableModel;
	const supportsImages = selectedModel?.input.includes("image") ?? false;
	const hasUnsupportedAttachments = attachments.length > 0 && !supportsImages;
	const canSend = canCompose
		&& !attachmentState.isAdding
		&& (draft.trim() !== "" || attachments.length > 0)
		&& !hasUnsupportedAttachments;
	const visibleError = attachmentState.error
		?? (hasUnsupportedAttachments ? "当前模型不支持图片输入，请切换模型或移除附件。" : error);

	async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (!canSend) return;
		const text = draft.trim();
		const images = attachments.map((attachment) => attachment.source);
		try {
			if (isStreaming) await session.steer(text, images);
			else await session.prompt(text, images);
			setDraft("");
			setAttachments([]);
		} catch {
			// ChatSession publishes the visible error into its snapshot.
		}
	}

	async function handleFollowUp(): Promise<void> {
		if (!isStreaming || !canSend) return;
		try {
			await session.followUp(draft.trim(), attachments.map((attachment) => attachment.source));
			setDraft("");
			setAttachments([]);
		} catch {
			// ChatSession publishes the visible error into its snapshot.
		}
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
		if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
		event.preventDefault();
		event.currentTarget.form?.requestSubmit();
	}

	function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>): void {
		void attachmentState.paste(event.clipboardData);
	}

	return (
		<div className="bg-background px-5 pb-4 pt-2">
			<form className="mx-auto max-w-3xl" onSubmit={(event) => void handleSubmit(event)}>
				<div className="rounded-2xl border bg-muted/20 p-3 focus-within:ring-2 focus-within:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-50">
					<ComposerAttachments
						activePreviewIndex={attachmentState.activePreviewIndex}
						attachments={attachments}
						onPreviewChange={attachmentState.setActivePreviewIndex}
						onRemove={attachmentState.remove}
						previewImages={attachmentState.previewImages}
					/>
					<textarea
						aria-label="发送给 Pi 的消息"
						className="block min-h-lh max-h-[8lh] w-full field-sizing-content resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
						disabled={isSending || !canCompose}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={handleKeyDown}
						onPaste={handlePaste}
						placeholder={composerPlaceholder(hasAvailableCredential, isStreaming)}
						rows={1}
						value={draft}
					/>
				</div>
				<ComposerToolbar
					attachmentCount={attachments.length}
					canCompose={canCompose}
					canSend={canSend}
					hasAvailableCredential={hasAvailableCredential}
					hasAvailableModel={hasAvailableModel}
					isAddingAttachments={attachmentState.isAdding}
					isSending={isSending}
					isStreaming={isStreaming}
					onChooseAttachments={() => void attachmentState.choose()}
					onFollowUp={handleFollowUp}
					openedSession={openedSession}
					session={session}
					supportsImages={supportsImages}
				/>
			</form>
			{visibleError ? (
				<p className="mx-auto mt-3 max-w-3xl text-sm text-destructive" role="alert">
					{visibleError}
				</p>
			) : null}
		</div>
	);
}

function composerPlaceholder(hasAvailableCredential: boolean, isStreaming: boolean): string {
	if (!hasAvailableCredential) return "连接模型提供商后即可开始对话…";
	return isStreaming ? "发送新指令以打断当前任务…" : "告诉 Pi 你想完成什么…";
}
