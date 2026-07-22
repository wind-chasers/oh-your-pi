import { expect, test } from "bun:test";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { toConversationEntry } from "@main/workspace/mapper";

test("保留 assistant 失败原因而不是渲染为空文本", () => {
	const entry = {
		type: "message",
		id: "assistant-entry",
		parentId: "user-entry",
		timestamp: "2026-07-23T00:00:00.000Z",
		message: {
			role: "assistant",
			content: [],
			stopReason: "error",
			errorMessage: "OAuth refresh failed for github-copilot",
		},
	} as unknown as SessionEntry;

	expect(toConversationEntry(entry)).toEqual([{
		id: "assistant-entry",
		parentId: "user-entry",
		timestamp: "2026-07-23T00:00:00.000Z",
		role: "assistant",
		text: "GitHub Copilot 登录已失效。请使用 Pi 的登录流程重新授权后重试。\n\n原始错误：OAuth refresh failed for github-copilot",
	}]);
});

test("将 assistant 的思考与最终文本分别映射", () => {
	const entry = {
		type: "message",
		id: "assistant-entry",
		parentId: "user-entry",
		timestamp: "2026-07-24T00:00:00.000Z",
		message: {
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "先分析用户的问题" },
				{ type: "text", text: "这是最终回复。" },
			],
		},
	} as unknown as SessionEntry;

	expect(toConversationEntry(entry)).toEqual([{
		id: "assistant-entry",
		parentId: "user-entry",
		timestamp: "2026-07-24T00:00:00.000Z",
		role: "assistant",
		text: "这是最终回复。",
		thinking: "先分析用户的问题",
	}]);
});
