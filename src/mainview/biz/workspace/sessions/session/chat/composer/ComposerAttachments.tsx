import { X } from "lucide-react";
import { type ReactElement, type ReactNode } from "react";
import type { PiImageAttachment } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import { ImagePreviewDialog, type PreviewImage } from "../ImagePreviewDialog";

type ComposerAttachmentsProps = {
	activePreviewIndex: number | null;
	attachments: readonly PiImageAttachment[];
	onPreviewChange: (index: number | null) => void;
	onRemove: (id: string) => void;
	previewImages: readonly PreviewImage[];
	tip?: ReactNode;
};

export function ComposerAttachments({
	activePreviewIndex,
	attachments,
	onPreviewChange,
	onRemove,
	previewImages,
	tip,
}: ComposerAttachmentsProps): ReactElement | null {
	if (attachments.length === 0) return null;
	return (
		<>
			{tip}
			<div aria-label="已选择的图片附件" className="mb-3 flex gap-2 pb-1">
				{attachments.map((attachment, index) => (
					<div className="relative shrink-0" key={attachment.id}>
						<Button
							aria-label={`预览图片 ${attachment.name}`}
							className="size-14 overflow-hidden p-0"
							onClick={() => onPreviewChange(index)}
							size="icon"
							type="button"
							variant="outline"
						>
							<img alt="" className="size-full object-cover" src={attachment.previewDataUrl} />
						</Button>
						<Button
							aria-label={`移除图片 ${attachment.name}`}
							className="absolute -right-2 -top-2 rounded-full shadow-sm"
							onClick={() => onRemove(attachment.id)}
							size="icon-xs"
							type="button"
							variant="secondary"
						>
							<X aria-hidden />
						</Button>
					</div>
				))}
			</div>
			<ImagePreviewDialog
				activeIndex={activePreviewIndex}
				images={previewImages}
				onActiveIndexChange={onPreviewChange}
			/>
		</>
	);
}
