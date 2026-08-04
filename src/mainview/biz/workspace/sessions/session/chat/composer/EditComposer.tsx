import { type SubmitEvent, useState } from "react";
import { type PiImageAttachment, PI_IMAGE_ATTACHMENT_LIMIT } from "@shared/pi-contract";
import type { ImageContent } from "@earendil-works/pi-ai";
import type { ChatSession } from "@view/chat-store";
import type { UserViewItem } from "@view/chat-store/session-view";
import { Button } from "@view/components/ui/button";
import { ImageOff, LoaderCircle, Send } from "lucide-react";
import { EditEditorAtom } from "../../session.atom";
import { ComposerAttachments } from "./ComposerAttachments";
import { AuthenticationEntry, AttachmentEntry } from "./ComposerToolbar";
import { Editor } from "./editor";
import { ModelThinkingSelector } from "./ModelThinkingSelector";
import { useLLMStatus } from "./ChatComposer";
import { useComposerAttachments } from "./use-composer-attachments";

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

  const editor = EditEditorAtom.useDerived();
  const isEditorValid = editor.useValid();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();
	const [attachments, setAttachments] = useState<PiImageAttachment[]>(translateImages(target.images));
	const attachmentState = useComposerAttachments({ attachments, onChange: setAttachments });

  const openedSession = session.snapshot.useOpenedSession()!;
  const { hasValidProvider, isValidModel, supportsImages } = useLLMStatus(openedSession);

  const images = supportsImages ? attachments : [];
  const hasTooManyImages = images.length > PI_IMAGE_ATTACHMENT_LIMIT;
  const canSend = !isSending && !attachmentState.isAdding && isValidModel && !hasTooManyImages && (isEditorValid || images.length > 0);
  const canAttach = !isSending && attachments.length < PI_IMAGE_ATTACHMENT_LIMIT;

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
    if (!canSend) return;
    setError(undefined);
    setIsSending(true);
		try {
      await session.regenerate(target.entryId, { text: editor.get().draft.trim(), attachments: images });
      cancel();
		} catch (submitError) {
      setError(toErrorMessage(submitError));
      setIsSending(false);
		}
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
  const visibleError = attachmentState.error
    ?? (hasTooManyImages ? `每条消息最多附加 ${PI_IMAGE_ATTACHMENT_LIMIT} 张图片。` : error);

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
          <Editor
            atom={EditEditorAtom}
            disabled={isSending}
            focusOnMount
            onPaste={handlePaste}
            placeholder={composerPlaceholder(hasValidProvider)}
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
        {visibleError && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {visibleError}
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
