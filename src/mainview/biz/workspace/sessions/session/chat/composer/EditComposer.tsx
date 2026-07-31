import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { type PiImageAttachment, PI_IMAGE_ATTACHMENT_LIMIT } from "@shared/pi-contract";
import type { ChatSession } from "@view/chat-store";
import { ComposerAttachments } from "./ComposerAttachments";
import { useComposerAttachments } from "./use-composer-attachments";
import { ImageOff, LoaderCircle, Send } from "lucide-react";
import { Button } from "@view/components/ui/button";
import { ModelThinkingSelector } from "./ModelThinkingSelector";
import { UserViewItem } from "@view/chat-store/session-view";
import { AuthenticationEntry, AttachmentEntry } from './ComposerToolbar';
import { useLLMStatus } from "./ChatComposer";
import type { ImageContent } from "@earendil-works/pi-ai";

function translateImages(input: readonly ImageContent[]): PiImageAttachment[] {
  return input.map((image, index) => {
    const name = "untitled-" + index;
    return {
      id: crypto.randomUUID(),
      source: { type: "data", data: image.data, mimeType: image.mimeType, name },
      name,
      previewDataUrl: `data:${image.mimeType};base64,${image.data}`,
    };
  });
}

export function EditComposer(props: {
  target: UserViewItem;
  session: ChatSession;
  cancel: () => void;
}) {
  const { target, session, cancel } = props;

  const editor = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState(target.text);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();
	const [attachments, setAttachments] = useState<PiImageAttachment[]>(translateImages(target.images));
	const attachmentState = useComposerAttachments({ attachments, onChange: setAttachments });

  const openedSession = session.snapshot.useOpenedSession()!;
  const { hasValidProvider, isValidModel, supportsImages } = useLLMStatus(openedSession);
  useEffect(() => {
    if (editor.current) {
      const length = editor.current.value.length;
      editor.current.focus();
      editor.current.setSelectionRange(length, length);
    }
  }, []);

  const images = supportsImages ? attachments : [];
  const canSend = !isSending && !attachmentState.isAdding && isValidModel && (draft.trim() !== "" || images.length > 0);
  const canAttach =  !isSending && attachments.length < PI_IMAGE_ATTACHMENT_LIMIT;

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
    if (!canSend) return;
    setError(undefined);
    setIsSending(true);
		try {
      await session.regenerate(target.entryId, { text: draft, attachments: images });
      cancel();
		} catch (submitError) {
      setError(toErrorMessage(submitError));
      setIsSending(false);
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

  const attachTip = !supportsImages && (
    <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-300" role="status">
      <ImageOff aria-hidden size={12} />
      <span>当前模型不支持图片，这些附件不会被发送。</span>
    </p>
  );

  return (
    <div className="bg-background">
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="px-3 py-1">
          <ComposerAttachments
            activePreviewIndex={attachmentState.activePreviewIndex}
            attachments={attachments}
            onPreviewChange={attachmentState.setActivePreviewIndex}
            onRemove={attachmentState.remove}
            previewImages={attachmentState.previewImages}
            tip={attachTip}
          />
          <textarea
            aria-label="发送给 Pi 的消息"
            className="block min-h-lh max-h-[8lh] w-full field-sizing-content resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground/40"
            disabled={isSending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={composerPlaceholder(hasValidProvider)}
            rows={1}
            value={draft}
            ref={editor}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 px-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <AttachmentEntry disabled={!canAttach} onChoose={attachmentState.choose} loading={attachmentState.isAdding} supports={supportsImages} />
            <ModelThinkingSelector isUpdating={isSending} openedSession={openedSession} session={session} />
          </div>

          <div className="flex items-center gap-2">
            <Button disabled={isSending} onClick={cancel} size="sm" type="button" variant="link">取消</Button>
            {hasValidProvider ? (
              <Button size="sm" type="submit" disabled={!canSend}>
                {isSending
                  ? <LoaderCircle aria-hidden className="animate-spin" data-icon="inline-start" />
                  : <Send aria-hidden data-icon="inline-start" />}
                重新生成
              </Button>
            ) : <AuthenticationEntry />}
          </div>
        </div>
        {(attachmentState.error ?? error) && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {attachmentState.error ?? error}
          </p>
        )}
      </form>
    </div>
  );
}

function composerPlaceholder(hasValidProvider: boolean): string {
	if (!hasValidProvider) return "连接模型提供商后即可开始对话…";
	return "告诉 Pi 你想完成什么…";
}


function toErrorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : "无法重新生成历史消息。";
}
