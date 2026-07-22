import { expect, test } from "bun:test";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { startSessionPrompt } from "@main/pi/prompt";

test("在 Pi 接受 prompt 后立即返回，不等待完整回复", async () => {
	let completeRun: (() => void) | undefined;
	const session = {
		prompt: (_text: string, options?: Parameters<AgentSession["prompt"]>[1]) => {
			options?.preflightResult?.(true);
			const { promise, resolve } = Promise.withResolvers<void>();
			completeRun = resolve;
			return promise;
		},
	};

	await startSessionPrompt(session, "Reply with exactly OK.", () => {
		throw new Error("不应在成功流式运行时报告错误。");
	});
	expect(completeRun).toBeDefined();
	completeRun?.();
});

test("Pi 在接受前拒绝 prompt 时向调用方报告失败", async () => {
	const rejection = new Error("authentication failed");
	const reported: unknown[] = [];
	const session = {
		prompt: (_text: string, options?: Parameters<AgentSession["prompt"]>[1]) => {
			options?.preflightResult?.(false);
			return Promise.reject(rejection);
		},
	};

	await expect(startSessionPrompt(session, "hello", (error) => reported.push(error))).rejects.toThrow("Pi 未接受这条消息。");
	await Promise.resolve();
	expect(reported).toEqual([rejection]);
});
