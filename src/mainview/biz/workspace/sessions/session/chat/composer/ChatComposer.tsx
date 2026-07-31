import { type SubmitEvent, type ReactElement, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { PiImageAttachment, PiOpenedSession } from "@shared/pi-contract";
import type { ChatQueuedInputs, ChatSession } from "@view/chat-store";
import { AuthenticationAtom } from "@view/states/authentication.atom";
import { ComposerAttachments } from "./ComposerAttachments";
import { ComposerToolbar } from "./ComposerToolbar";
import { QueuedInputs } from "./QueuedInputs";
import { useComposerAttachments } from "./use-composer-attachments";

type ChatComposerProps = {
	error?: string | null;
	isSending: boolean;
	openedSession: PiOpenedSession;
	queuedInputs: ChatQueuedInputs;
	session: ChatSession;
};

export function useLLMStatus(openedSession: PiOpenedSession) {
	const authentication = AuthenticationAtom.useData() ?? [];
	const validProviders = useMemo(() => {
		const set = new Set<string>();
		for (const { status, provider } of authentication) {
			if (status === "available") set.add(provider);
		}
		return set;
	}, [authentication]);

	const { model } = openedSession.runtime;
	return {
		hasValidProvider: validProviders.size > 0,
		isValidModel: model !== undefined && validProviders.has(model.provider),
		supportsImages: model ? model.input.includes("image") : false,
	};
}

export function ChatComposer({
	error,
	isSending,
	openedSession,
	queuedInputs,
	session,
}: ChatComposerProps): ReactElement {
	const [draft, setDraft] = useState("");
	const [attachments, setAttachments] = useState<PiImageAttachment[]>([]);
	const attachmentState = useComposerAttachments({
		attachments,
		onChange: setAttachments,
	});
	const isStreaming = openedSession.runtime.isStreaming;
	const { hasValidProvider, isValidModel, supportsImages } = useLLMStatus(openedSession);

	const canCompose = hasValidProvider && isValidModel;
	const hasUnsupportedAttachments = attachments.length > 0 && !supportsImages;
	const canSend = canCompose
		&& !attachmentState.isAdding
		&& (draft.trim() !== "" || attachments.length > 0)
		&& !hasUnsupportedAttachments;
	const visibleError = attachmentState.error
		?? (hasUnsupportedAttachments ? "当前模型不支持图片输入，请切换模型或移除附件。" : error);

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (!canSend) return;
		const text = draft.trim();
		try {
			if (isStreaming) await session.steer({ text, attachments });
			else await session.prompt({ text, attachments });
			setDraft("");
			setAttachments([]);
		} catch {
			// ChatSession publishes the visible error into its snapshot.
		}
	}

	async function handleFollowUp(): Promise<void> {
		if (!isStreaming || !canSend) return;
		try {
			await session.followUp({ text: draft.trim(), attachments });
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
			<QueuedInputs items={queuedInputs} />
			<form
				className="mx-auto max-w-3xl rounded-lg border p-2 outline-2 outline-transparent transition-colors focus-within:border-blue-500/60 focus-within:outline-blue-500/20"
				onSubmit={(event) => void handleSubmit(event)}
			>
				<div className="p-3 has-disabled:cursor-not-allowed has-disabled:opacity-50">
					<ComposerAttachments
						activePreviewIndex={attachmentState.activePreviewIndex}
						attachments={attachments}
						onPreviewChange={attachmentState.setActivePreviewIndex}
						onRemove={attachmentState.remove}
						previewImages={attachmentState.previewImages}
					/>
					<textarea
						aria-label="发送给 Pi 的消息"
						className="block min-h-lh max-h-[8lh] w-full field-sizing-content resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground/40"
						disabled={isSending || !canCompose}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={handleKeyDown}
						onPaste={handlePaste}
						placeholder={composerPlaceholder(hasValidProvider, isStreaming)}
						rows={1}
						value={draft}
					/>
				</div>
				<ComposerToolbar
					attachmentCount={attachments.length}
					canCompose={canCompose}
					canSend={canSend}
					hasAvailableCredential={hasValidProvider}
					hasAvailableModel={isValidModel}
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
			{visibleError && (
				<p className="mx-auto mt-2 pl-1 max-w-3xl text-sm text-destructive flex items-center gap-1" role="alert">
					<ShieldAlert size={12} />
					<span>{visibleError}</span>
				</p>
			)}
		</div>
	);
}

function composerPlaceholder(hasAvailableCredential: boolean, isStreaming: boolean): string {
	if (!hasAvailableCredential) return "连接模型提供商后即可开始对话…";
	return isStreaming ? "发送新指令以打断当前任务…" : "告诉 Pi 你想完成什么…";
}
