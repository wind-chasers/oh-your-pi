import type { ImageContent } from "@earendil-works/pi-ai";
import { type ReactElement, useState } from "react";
import { ImagePreviewDialog } from "../ImagePreviewDialog";
import { MarkdownContent } from "@view/components/markdown-content";
import { Button } from "@view/components/ui/button";
import { cn } from "@view/lib/utils";

type UserMessageProps = {
	images: readonly ImageContent[];
	text: string;
};

export function UserMessage({ images, text }: UserMessageProps) {
	if (images.length === 0 && text.trim() === "") {
		return null;
	}

	return (
		<article className="ml-auto w-fit max-w-[85%]" data-dbg="user-message">
			<div className="flex flex-col gap-2 rounded-2xl rounded-br-xs bg-primary px-4 py-2 text-sm text-primary-foreground">
				{images.length > 0 ? <UserMessageImages images={images} /> : null}
				{text ? <MarkdownContent>{text}</MarkdownContent> : null}
			</div>
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
