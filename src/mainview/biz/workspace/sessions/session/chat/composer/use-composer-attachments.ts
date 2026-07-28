import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import {
	PI_IMAGE_ATTACHMENT_LIMIT,
	type PiImageAttachment,
} from "@shared/pi-contract";
import { choosePiImageAttachments } from "@view/lib/pi-client";
import type { PreviewImage } from "../ImagePreviewDialog";
import {
	clipboardContainsImage,
	getClipboardImageFiles,
	readPastedImageAttachments,
} from "./paste";

type ComposerAttachmentsOptions = {
	attachments: readonly PiImageAttachment[];
	onChange: (attachments: PiImageAttachment[]) => void;
};

type ComposerAttachmentsState = {
	activePreviewIndex: number | null;
	choose: () => Promise<void>;
	error: string | undefined;
	isAdding: boolean;
	paste: (clipboardData: DataTransfer) => Promise<void>;
	previewImages: PreviewImage[];
	remove: (id: string) => void;
	setActivePreviewIndex: Dispatch<SetStateAction<number | null>>;
};

export function useComposerAttachments({
	attachments,
	onChange,
}: ComposerAttachmentsOptions): ComposerAttachmentsState {
	const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(null);
	const [error, setError] = useState<string>();
	const [isChoosing, setIsChoosing] = useState(false);
	const [isPasting, setIsPasting] = useState(false);
	const isAdding = isChoosing || isPasting;

	useEffect(() => {
		if (activePreviewIndex !== null && activePreviewIndex >= attachments.length) {
			setActivePreviewIndex(null);
		}
	}, [activePreviewIndex, attachments.length]);

	function append(selected: readonly PiImageAttachment[]): void {
		if (selected.length === 0) return;
		const identities = new Set(attachments.map(attachmentIdentity));
		const additions = selected.filter((attachment) => !identities.has(attachmentIdentity(attachment)));
		const capacity = PI_IMAGE_ATTACHMENT_LIMIT - attachments.length;
		onChange([...attachments, ...additions.slice(0, capacity)]);
		if (additions.length > capacity) {
			setError(`每条消息最多附加 ${PI_IMAGE_ATTACHMENT_LIMIT} 张图片。`);
		}
	}

	async function choose(): Promise<void> {
		if (isAdding || attachments.length >= PI_IMAGE_ATTACHMENT_LIMIT) return;
		setIsChoosing(true);
		setError(undefined);
		try {
			append(await choosePiImageAttachments());
		} catch (selectionError) {
			setError(toErrorMessage(selectionError, "无法选择图片附件。"));
		} finally {
			setIsChoosing(false);
		}
	}

	async function paste(clipboardData: DataTransfer): Promise<void> {
		if (!clipboardContainsImage(clipboardData) || isAdding) return;
		const capacity = PI_IMAGE_ATTACHMENT_LIMIT - attachments.length;
		if (capacity <= 0) {
			setError(`每条消息最多附加 ${PI_IMAGE_ATTACHMENT_LIMIT} 张图片。`);
			return;
		}
		const imageCount = getClipboardImageFiles(clipboardData).length;
		setIsPasting(true);
		setError(undefined);
		try {
			append(await readPastedImageAttachments(clipboardData, capacity));
			if (imageCount > capacity) {
				setError(`每条消息最多附加 ${PI_IMAGE_ATTACHMENT_LIMIT} 张图片。`);
			}
		} catch (pasteError) {
			setError(toErrorMessage(pasteError, "无法读取剪贴板图片。"));
		} finally {
			setIsPasting(false);
		}
	}

	function remove(id: string): void {
		setActivePreviewIndex(null);
		setError(undefined);
		onChange(attachments.filter((attachment) => attachment.id !== id));
	}

	const previewImages: PreviewImage[] = attachments.map((attachment) => ({
		alt: attachment.name,
		src: attachment.previewDataUrl,
	}));

	return {
		activePreviewIndex,
		choose,
		error,
		isAdding,
		paste,
		previewImages,
		remove,
		setActivePreviewIndex,
	};
}

function attachmentIdentity(attachment: PiImageAttachment): string {
	return attachment.source.type === "path"
		? `path:${attachment.source.path}`
		: `data:${attachment.id}`;
}

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
