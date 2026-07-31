import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { PI_IMAGE_ATTACHMENT_LIMIT } from "@shared/pi-contract";
import {
	inspectPiImageAttachments,
	loadPiImageAttachments,
} from "./image-attachments";

const imagePath = resolve(import.meta.dir, "../../../../assets/app-icon.png");

test("生成 Renderer 预览并编码为 Pi 图片内容", async () => {
	const [preview] = await inspectPiImageAttachments([imagePath]);
	expect(preview.name).toBe("app-icon.png");
	expect(preview.previewDataUrl).toStartWith("data:image/webp;base64,");

	const [content] = await loadPiImageAttachments([preview.source]);
	expect(content.type).toBe("image");
	expect(content.mimeType).toBe("image/webp");
	expect(content.data.length).toBeGreaterThan(0);
});

test("处理没有系统路径的剪贴板图片数据", async () => {
	const data = Buffer.from(await Bun.file(imagePath).arrayBuffer()).toString("base64");
	const [content] = await loadPiImageAttachments([{
		type: "data",
		data,
		mimeType: "image/png",
		name: "剪贴板图片.png",
	}]);
	expect(content.type).toBe("image");
	expect(content.mimeType).toBe("image/webp");
	expect(content.data.length).toBeGreaterThan(0);
});

test("拒绝超过单条消息上限的图片", async () => {
	const paths = Array.from({ length: PI_IMAGE_ATTACHMENT_LIMIT + 1 }, () => imagePath);
	await expect(inspectPiImageAttachments(paths)).rejects.toThrow(
		`每条消息最多附加 ${PI_IMAGE_ATTACHMENT_LIMIT} 张图片。`,
	);
});
