import { readFile, realpath, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { ImageContent } from "@earendil-works/pi-ai";
import {
	PI_IMAGE_ATTACHMENT_LIMIT,
	PI_IMAGE_ATTACHMENT_MAX_SOURCE_BYTES,
	PI_IMAGE_ATTACHMENT_MAX_SOURCE_PIXELS,
	type PiImageAttachment,
	type PiImageAttachmentSource,
} from "@shared/pi-contract";

const MAX_SOURCE_BASE64_LENGTH = Math.ceil(PI_IMAGE_ATTACHMENT_MAX_SOURCE_BYTES / 3) * 4;
const MAX_SOURCE_PIXELS = PI_IMAGE_ATTACHMENT_MAX_SOURCE_PIXELS;
const MAX_INLINE_BASE64_LENGTH = 4.5 * 1024 * 1024;
const PREVIEW_SIZE = 1_600;
const ENCODE_ATTEMPTS = [
	{ size: 2_000, quality: 85 },
	{ size: 2_000, quality: 70 },
	{ size: 1_600, quality: 80 },
	{ size: 1_600, quality: 65 },
	{ size: 1_280, quality: 75 },
	{ size: 1_024, quality: 70 },
] as const;

type LoadedImage = {
	bytes: Buffer;
	name: string;
};

export async function inspectPiImageAttachments(paths: readonly string[]): Promise<PiImageAttachment[]> {
	const sources = validateImageSources(paths.map((path) => ({ type: "path", path })));
	const attachments: PiImageAttachment[] = [];
	for (const source of sources) {
		if (source.type !== "path") continue;
		const path = await resolveImagePath(source.path);
		const name = basename(path);
		const bytes = await readPathImage(path, name);
		const image = new Bun.Image(bytes, { maxPixels: MAX_SOURCE_PIXELS });
		const metadata = await readMetadata(image, name);
		const previewDataUrl = await new Bun.Image(bytes, { maxPixels: MAX_SOURCE_PIXELS })
			.resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: "inside", withoutEnlargement: true })
			.webp({ quality: 82 })
			.dataurl()
			.catch(() => {
				throw new Error(`无法生成图片预览：${name}`);
			});
		attachments.push({
			id: crypto.randomUUID(),
			source: { type: "path", path },
			name,
			previewDataUrl,
			width: metadata.width,
			height: metadata.height,
		});
	}
	return attachments;
}

export async function loadPiImageAttachments(
	sources: readonly PiImageAttachmentSource[],
): Promise<ImageContent[]> {
	const attachments: ImageContent[] = [];
	for (const source of validateImageSources(sources)) {
		const { bytes, name } = await loadImageSource(source);
		await readMetadata(new Bun.Image(bytes, { maxPixels: MAX_SOURCE_PIXELS }), name);
		let encoded: ImageContent | undefined;
		for (const attempt of ENCODE_ATTEMPTS) {
			const data = await new Bun.Image(bytes, { maxPixels: MAX_SOURCE_PIXELS })
				.resize(attempt.size, attempt.size, { fit: "inside", withoutEnlargement: true })
				.webp({ quality: attempt.quality })
				.toBase64()
				.catch(() => null);
			if (data && data.length <= MAX_INLINE_BASE64_LENGTH) {
				encoded = { type: "image", data, mimeType: "image/webp" };
				break;
			}
		}
		if (!encoded) throw new Error(`图片处理后仍超过模型可接受的大小：${name}`);
		attachments.push(encoded);
	}
	return attachments;
}

function validateImageSources(
	sources: readonly PiImageAttachmentSource[],
): PiImageAttachmentSource[] {
	if (sources.length > PI_IMAGE_ATTACHMENT_LIMIT) {
		throw new Error(`每条消息最多附加 ${PI_IMAGE_ATTACHMENT_LIMIT} 张图片。`);
	}
	const paths = new Set<string>();
	return sources.map((source) => {
		if (source.type === "path") {
			const path = source.path.trim();
			if (!path) throw new Error("图片附件路径不能为空。");
			if (paths.has(path)) throw new Error("不能重复附加同一张图片。");
			paths.add(path);
			return { type: "path", path };
		}
		const name = source.name.trim();
		if (!name || !source.mimeType.startsWith("image/") || !source.data) {
			throw new Error("剪贴板图片数据无效。");
		}
		if (source.data.length > MAX_SOURCE_BASE64_LENGTH) {
			throw new Error(`图片文件超过 64 MB：${name}`);
		}
		return { ...source, name };
	});
}

async function loadImageSource(source: PiImageAttachmentSource): Promise<LoadedImage> {
	if (source.type === "path") {
		const path = await resolveImagePath(source.path);
		const name = basename(path);
		return { bytes: await readPathImage(path, name), name };
	}
	const bytes = Buffer.from(source.data, "base64");
	if (bytes.byteLength === 0) throw new Error(`剪贴板图片数据无效：${source.name}`);
	if (bytes.byteLength > PI_IMAGE_ATTACHMENT_MAX_SOURCE_BYTES) {
		throw new Error(`图片文件超过 64 MB：${source.name}`);
	}
	return { bytes, name: source.name };
}

async function resolveImagePath(inputPath: string): Promise<string> {
	const path = await realpath(inputPath).catch(() => {
		throw new Error(`找不到图片文件：${basename(inputPath) || inputPath}`);
	});
	const fileStat = await stat(path);
	if (!fileStat.isFile()) throw new Error(`所选附件不是文件：${basename(path)}`);
	if (fileStat.size > PI_IMAGE_ATTACHMENT_MAX_SOURCE_BYTES) {
		throw new Error(`图片文件超过 64 MB：${basename(path)}`);
	}
	return path;
}

async function readPathImage(path: string, name: string): Promise<Buffer> {
	const bytes = await readFile(path);
	if (bytes.byteLength > PI_IMAGE_ATTACHMENT_MAX_SOURCE_BYTES) {
		throw new Error(`图片文件超过 64 MB：${name}`);
	}
	return bytes;
}

async function readMetadata(image: Bun.Image, name: string): Promise<Bun.Image.Metadata> {
	return image.metadata().catch(() => {
		throw new Error(`不支持或无法读取此图片：${name}`);
	});
}
