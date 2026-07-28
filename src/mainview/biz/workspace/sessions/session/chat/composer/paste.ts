import {
	PI_IMAGE_ATTACHMENT_LIMIT,
	PI_IMAGE_ATTACHMENT_MAX_SOURCE_BYTES,
	PI_IMAGE_ATTACHMENT_MAX_SOURCE_PIXELS,
	type PiImageAttachment,
} from "@shared/pi-contract";

const PREVIEW_MAX_SIZE = 1_600;
const PREVIEW_QUALITY = 0.82;

export function clipboardContainsImage(clipboardData: DataTransfer): boolean {
	for (let index = 0; index < clipboardData.items.length; index += 1) {
		const item = clipboardData.items[index];
		if (item.kind === "file" && isRasterImageType(item.type)) return true;
	}
	for (let index = 0; index < clipboardData.files.length; index += 1) {
		if (isRasterImageType(clipboardData.files[index].type)) return true;
	}
	return false;
}

export function getClipboardImageFiles(clipboardData: DataTransfer): File[] {
	const itemFiles: File[] = [];
	for (let index = 0; index < clipboardData.items.length; index += 1) {
		const item = clipboardData.items[index];
		if (item.kind !== "file" || !isRasterImageType(item.type)) continue;
		const file = item.getAsFile();
		if (file) itemFiles.push(file);
	}
	if (itemFiles.length > 0) return itemFiles;

	const files: File[] = [];
	for (let index = 0; index < clipboardData.files.length; index += 1) {
		const file = clipboardData.files[index];
		if (isRasterImageType(file.type)) files.push(file);
	}
	return files;
}

export async function readPastedImageAttachments(
	clipboardData: DataTransfer,
	maxCount = PI_IMAGE_ATTACHMENT_LIMIT,
): Promise<PiImageAttachment[]> {
	const attachments: PiImageAttachment[] = [];
	const files = getClipboardImageFiles(clipboardData);
	const count = Math.min(files.length, Math.max(0, maxCount), PI_IMAGE_ATTACHMENT_LIMIT);
	for (let index = 0; index < count; index += 1) {
		attachments.push(await fileToImageAttachment(files[index], index));
	}
	return attachments;
}

async function fileToImageAttachment(file: File, index: number): Promise<PiImageAttachment> {
	const name = file.name || `剪贴板图片 ${index + 1}.${extensionForMimeType(file.type)}`;
	if (file.size === 0) throw new Error(`剪贴板图片没有可读取的数据：${name}`);
	if (file.size > PI_IMAGE_ATTACHMENT_MAX_SOURCE_BYTES) {
		throw new Error(`图片文件超过 64 MB：${name}`);
	}
	const { width, height, previewDataUrl } = await createImagePreview(file, name);
	const dataUrl = await readBlobDataUrl(file);
	const separatorIndex = dataUrl.indexOf(",");
	if (separatorIndex < 0 || !dataUrl.slice(0, separatorIndex).includes(";base64")) {
		throw new Error(`无法读取剪贴板图片数据：${name}`);
	}
	return {
		id: crypto.randomUUID(),
		source: {
			type: "data",
			data: dataUrl.slice(separatorIndex + 1),
			mimeType: file.type,
			name,
		},
		name,
		previewDataUrl,
		width,
		height,
	};
}

async function createImagePreview(
	file: File,
	name: string,
): Promise<{ width: number; height: number; previewDataUrl: string }> {
	const image = await loadImage(file, name);
	try {
		const width = image.naturalWidth;
		const height = image.naturalHeight;
		if (!width || !height || width * height > PI_IMAGE_ATTACHMENT_MAX_SOURCE_PIXELS) {
			throw new Error(`图片尺寸无效或像素过多：${name}`);
		}
		const scale = Math.min(1, PREVIEW_MAX_SIZE / width, PREVIEW_MAX_SIZE / height);
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		const context = canvas.getContext("2d");
		if (!context) throw new Error(`无法生成图片预览：${name}`);
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		return {
			width,
			height,
			previewDataUrl: canvas.toDataURL("image/webp", PREVIEW_QUALITY),
		};
	} finally {
		URL.revokeObjectURL(image.src);
	}
}

function loadImage(file: File, name: string): Promise<HTMLImageElement> {
	const source = URL.createObjectURL(file);
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => {
			URL.revokeObjectURL(source);
			reject(new Error(`无法解析剪贴板图片：${name}`));
		};
		image.src = source;
	});
}

function readBlobDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") resolve(reader.result);
			else reject(new Error("无法读取剪贴板图片数据。"));
		};
		reader.onerror = () => reject(reader.error ?? new Error("无法读取剪贴板图片数据。"));
		reader.readAsDataURL(blob);
	});
}

function isRasterImageType(mimeType: string): boolean {
	return mimeType.startsWith("image/") && mimeType !== "image/svg+xml";
}

function extensionForMimeType(mimeType: string): string {
	const subtype = mimeType.slice("image/".length).split(";")[0].split("+")[0];
	return subtype === "jpeg" ? "jpg" : subtype || "png";
}
