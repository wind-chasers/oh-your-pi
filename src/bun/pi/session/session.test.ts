import { expect, test } from "bun:test";
import type { PromptOptions } from "@earendil-works/pi-coding-agent";
import { submitSessionPrompt } from "./session";

test("在 Pi 接受 prompt 后立即返回，不等待完整回复", async () => {
	let completeRun: (() => void) | undefined;
	const images: NonNullable<PromptOptions["images"]> = [
		{ type: "image", data: "aW1hZ2U=", mimeType: "image/webp" },
	];
	let submittedImages: PromptOptions["images"];
	const session = {
		prompt: (_text: string, options?: PromptOptions) => {
			submittedImages = options?.images;
			options?.preflightResult?.(true);
			const { promise, resolve } = Promise.withResolvers<void>();
			completeRun = resolve;
			return promise;
		},
	};

	await submitSessionPrompt(session, "Reply with exactly OK.", images, () => {
		throw new Error("不应在成功流式运行时报告错误。");
	});
	expect(completeRun).toBeDefined();
	expect(submittedImages).toEqual(images);
	completeRun?.();
});

test("Pi 在接受前拒绝 prompt 时向调用方报告失败", async () => {
	const rejection = new Error("authentication failed");
	const reported: Error[] = [];
	const session = {
		prompt: (_text: string, options?: PromptOptions) => {
			options?.preflightResult?.(false);
			return Promise.reject(rejection);
		},
	};

	await expect(submitSessionPrompt(session, "hello", undefined, (error) => reported.push(error)))
		.rejects.toThrow("Pi 未接受这条消息。");
	await Promise.resolve();
	expect(reported).toEqual([rejection]);
});
