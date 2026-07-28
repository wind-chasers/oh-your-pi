import { expect, test } from "bun:test";
import {
	clipboardContainsImage,
	getClipboardImageFiles,
} from "./paste";

function clipboardData(options: {
	files?: File[];
	items?: Array<{ file: File | null; kind?: string; type: string }>;
}): DataTransfer {
	const files = options.files ?? [];
	const items = (options.items ?? []).map((item) => ({
		kind: item.kind ?? "file",
		type: item.type,
		getAsFile: () => item.file,
	}));
	return {
		files: Object.assign(files, { item: (index: number) => files[index] ?? null }),
		items: Object.assign(items, { item: (index: number) => items[index] ?? null }),
	} as unknown as DataTransfer;
}

test("优先读取剪贴板中的二进制图片条目", () => {
	const image = new File(["image"], "screenshot.png", { type: "image/png" });
	const data = clipboardData({
		files: [new File(["ignored"], "fallback.png", { type: "image/png" })],
		items: [{ file: image, type: "image/png" }],
	});
	expect(clipboardContainsImage(data)).toBeTrue();
	expect(getClipboardImageFiles(data)).toEqual([image]);
});

test("忽略文本、SVG 和空文件条目", () => {
	const svg = new File(["<svg/>"] , "unsafe.svg", { type: "image/svg+xml" });
	const data = clipboardData({
		items: [
			{ file: null, kind: "string", type: "text/plain" },
			{ file: svg, type: "image/svg+xml" },
		],
	});
	expect(clipboardContainsImage(data)).toBeFalse();
	expect(getClipboardImageFiles(data)).toEqual([]);
});

test("缺少可用 item 时回退到 clipboard files", () => {
	const image = new File(["image"], "clipboard.webp", { type: "image/webp" });
	const data = clipboardData({ files: [image], items: [{ file: null, type: "image/png" }] });
	expect(getClipboardImageFiles(data)).toEqual([image]);
});
