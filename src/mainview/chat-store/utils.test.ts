import { expect, test } from "bun:test";
import type { PiImageAttachmentSource } from "@shared/pi-contract";
import { normalizePromptInput } from "./utils";

const clipboardImage: PiImageAttachmentSource = {
	type: "data",
	data: "aW1hZ2U=",
	mimeType: "image/png",
	name: "剪贴板图片.png",
};

test("允许只有剪贴板图片而没有文本的消息", () => {
	expect(normalizePromptInput("  ", [clipboardImage])).toEqual({
		text: "",
		images: [clipboardImage],
	});
});

test("拒绝伪装成图片的剪贴板数据", () => {
	expect(() => normalizePromptInput("分析", [{
		...clipboardImage,
		mimeType: "text/plain",
	}])).toThrow("剪贴板图片数据无效");
});
