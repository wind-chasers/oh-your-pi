import { expect, test } from "bun:test";
import type { PiConversationEntry } from "@main/pi";
import { toSessionTranscript } from "./snapshot";

const info = {
	id: "session",
	path: "/tmp/session.jsonl",
	workspacePath: "/tmp/workspace",
	name: null,
	firstMessage: "",
	messageCount: 1,
	modifiedAt: "2026-07-23T00:00:00.000Z",
};

test("保留 assistant 失败原因而不是渲染为空文本", () => {
	const entry: PiConversationEntry = {
		id: "assistant-entry",
		parentId: "user-entry",
		timestamp: "2026-07-23T00:00:00.000Z",
		role: "assistant",
		text: "",
		errorMessage: "OAuth refresh failed for github-copilot",
	};

	expect(toSessionTranscript(info, [entry]).entries).toEqual([{
		id: "assistant-entry",
		parentId: "user-entry",
		timestamp: "2026-07-23T00:00:00.000Z",
		role: "assistant",
		text: "GitHub Copilot 登录已失效。请使用 Pi 的登录流程重新授权后重试。\n\n原始错误：OAuth refresh failed for github-copilot",
	}]);
});

test("将 assistant 的思考与最终文本分别映射", () => {
	const entry: PiConversationEntry = {
		id: "assistant-entry",
		parentId: "user-entry",
		timestamp: "2026-07-24T00:00:00.000Z",
		role: "assistant",
		text: "这是最终回复。",
		thinking: "先分析用户的问题",
	};

	expect(toSessionTranscript(info, [entry]).entries).toEqual([{
		id: "assistant-entry",
		parentId: "user-entry",
		timestamp: "2026-07-24T00:00:00.000Z",
		role: "assistant",
		text: "这是最终回复。",
		thinking: "先分析用户的问题",
	}]);
});
