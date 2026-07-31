import { Pencil } from "lucide-react";
import { useState } from "react";
import type { ImageContent, UserMessage } from "@earendil-works/pi-ai";

import type { ChatMessageImagePreview } from "@view/chat-store/types";
import { ImagePreviewDialog } from "../ImagePreviewDialog";
import { MarkdownContent } from "@view/components/markdown/markdown-content";
import { Button } from "@view/components/ui/button";
import { cn } from "@view/lib/utils";
import { CopyButton, MessageTimestamp } from "./shared";
import { type UserViewItem, EditMessageAtom } from "../../editing-message";
import type { ChatSession } from "@view/chat-store";
import { EditComposer } from '../composer/EditComposer';

function translateImages(input: readonly ImageContent[]): ChatMessageImagePreview[] {
	return input.map((image, index) => ({
		id: `${index}`,
		alt: `图片附件 ${index + 1}`,
		src: `data:${image.mimeType};base64,${image.data}`,
	}));
}

export function UserMessage({ data, session }: {
	data: UserViewItem;
	session: ChatSession;
}) {
	const text = data.text.trim();
	if (data.images.length === 0 && !text) return null;
	const previews = translateImages(data.images);
	const timestamp = data.message.timestamp;

	return (
		<article className="ml-auto w-fit max-w-[90%]" data-dbg="user-message">
			<div className="flex flex-col gap-2 rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm">
				{previews.length > 0 && <UserMessageImages images={previews} />}
				{text && <MarkdownContent inverted>{text}</MarkdownContent>}
			</div>
			<UserFoot session={session} data={data} text={text} timestamp={timestamp} />
		</article>
	);
}

export function PendingUserMessage({ images, text }: {
	images: readonly ChatMessageImagePreview[];
	text: string;
}) {
	text = text.trim();
	if (images.length === 0 && !text) return null;
	return (
		<article className="ml-auto w-fit max-w-[90%]" data-dbg="pending-user-message">
			<div className="flex flex-col gap-2 rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm">
				<p className="text-xs font-medium text-primary-foreground/70">已发送</p>
				{images.length > 0 && <UserMessageImages images={images} />}
				{text && <MarkdownContent inverted>{text}</MarkdownContent>}
			</div>
		</article>
	);
}

export function EditingUserMessage({ data, session }:{
	data: UserViewItem;
	session: ChatSession;
}) {
	const editor = EditMessageAtom.useChange();
	return (
		<article className="ml-auto w-full rounded-xl border-2 border-primary p-2 text-sm" data-dbg="editing-user-message">
			<EditComposer target={data} session={session} cancel={editor.cancel} />
		</article>
	);
}

function UserMessageImages({ images }: {
	images: readonly ChatMessageImagePreview[];
}) {
	const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null);
	return (
		<>
			<div className="grid grid-cols-2 gap-2">
				{images.map((preview, index) => (
					<Button
						aria-label={`预览${preview.alt}`}
						className={cn(
							"overflow-hidden p-0 size-28",
							images.length === 1 && "col-span-2",
						)}
						key={images[index].id}
						onClick={() => setActivePreviewIndex(index)}
						size="icon"
						type="button"
						variant="secondary"
					>
						<img alt="" className="size-full object-cover" src={preview.src} />
					</Button>
				))}
			</div>
			<ImagePreviewDialog
				activeIndex={activePreviewIndex}
				images={images}
				onActiveIndexChange={setActivePreviewIndex}
			/>
		</>
	);
}

function UserFoot({ text, timestamp, session, data }: {
	text: string;
	timestamp: number;
	data: UserViewItem;
	session: ChatSession;
}) {
	const canEdit = session.snapshot.useIsIdle();
	const editor = EditMessageAtom.useChange();
	return (
		<div className="mt-1 pl-1 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
			<MessageTimestamp timestamp={timestamp} />
			<div className="flex items-center gap-1">
				<CopyButton content={text} disabled={!text} noun="消息" />
				<Button aria-label="编辑消息" disabled={!canEdit} size="icon-xs" title="暂不支持编辑消息" variant="ghost" onClick={() => editor.start(data)}>
					<Pencil aria-hidden />
				</Button>
			</div>
		</div>
	);
}
