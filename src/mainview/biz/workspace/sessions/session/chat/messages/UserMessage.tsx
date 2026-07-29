import type { ImageContent } from "@earendil-works/pi-ai";
import { Pencil } from "lucide-react";
import { type ReactElement, useState } from "react";
import { ImagePreviewDialog } from "../ImagePreviewDialog";
import { MarkdownContent } from "@view/components/markdown/markdown-content";
import { Button } from "@view/components/ui/button";
import { cn } from "@view/lib/utils";
import { CopyButton, MessageTimestamp } from "./shared";

type UserMessageProps = {
	images: readonly ImageContent[];
	text: string;
	isPending?: boolean;
	timestamp?: number;
};

export function UserMessage({ images, isPending = false, text, timestamp }: UserMessageProps): ReactElement | null {
	if (images.length === 0 && text.trim() === "") {
		return null;
	}

	return (
		<article className="ml-auto w-fit max-w-[90%]" data-dbg="user-message">
			<div className="flex flex-col gap-2 rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm">
				{isPending ? <p className="text-xs font-medium text-primary-foreground/70">已发送</p> : null}
				{images.length > 0 ? <UserMessageImages images={images} /> : null}
				{text ? <MarkdownContent inverted>{text}</MarkdownContent> : null}
			</div>
			<UserFoot text={text} timestamp={timestamp} />
		</article>
	);
}

type UserMessageImagesProps = {
	images: readonly ImageContent[];
};

function UserMessageImages({ images }: UserMessageImagesProps): ReactElement {
	const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null);
	const previews = images.map((image, index) => ({
		alt: `图片附件 ${index + 1}`,
		src: `data:${image.mimeType};base64,${image.data}`,
	}));

	return (
		<>
			<div className="grid grid-cols-2 gap-2">
				{previews.map((preview, index) => (
					<Button
						aria-label={`预览${preview.alt}`}
						className={cn(
							"overflow-hidden p-0 size-28",
							images.length === 1 && "col-span-2",
						)}
						key={index}
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
				images={previews}
				onActiveIndexChange={setActivePreviewIndex}
			/>
		</>
	);
}

function UserFoot({ text, timestamp }: { text: string; timestamp?: number }): ReactElement {
	return (
		<div className="mt-1 pl-1 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
			<MessageTimestamp timestamp={timestamp} />
			<div className="flex items-center gap-1">
				<CopyButton content={text} disabled={!text} noun="消息" />
				<Button aria-label="编辑消息" disabled size="icon-xs" title="暂不支持编辑消息" type="button" variant="ghost">
					<Pencil aria-hidden />
				</Button>
			</div>
		</div>
	);
}