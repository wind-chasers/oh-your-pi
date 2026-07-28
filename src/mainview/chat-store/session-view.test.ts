import { expect, test } from "bun:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { PiOpenedSession, PiSessionMessage } from "@shared/pi-contract";
import type { ChatSession } from "./session";
import { SessionView } from "./session-view";

const workspacePath = "/workspace";
const sessionId = "session-id";
const sessionPath = "/workspace/session.jsonl";
const usage = {
	cacheRead: 0,
	cacheWrite: 0,
	cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
	input: 0,
	output: 0,
	totalTokens: 0,
};

function assistant(toolCallId: string, text = ""): PiSessionMessage {
	const content: AssistantMessage["content"] = [];
	if (text) content.push({ type: "text", text });
	content.push({
		type: "toolCall",
		id: toolCallId,
		name: "read",
		arguments: { path: `/${toolCallId}` },
	});
	return {
		api: "test",
		provider: "test",
		model: "test",
		role: "assistant",
		content,
		stopReason: "toolUse",
		timestamp: 1,
		usage,
	};
}

function toolResult(toolCallId: string): PiSessionMessage {
	return {
		role: "toolResult",
		content: [{ type: "text", text: `result:${toolCallId}` }],
		toolCallId,
		toolName: "read",
		isError: false,
		timestamp: 2,
	};
}

function openedSession(messages: PiSessionMessage[]): PiOpenedSession {
	return {
		runtime: {
			sessionId,
			sessionPath,
			isStreaming: false,
			sessionName: undefined,
			model: undefined,
			models: [],
			thinkingLevel: "off",
			availableThinkingLevels: ["off"],
		},
		transcript: {
			session: {
				id: sessionId,
				path: sessionPath,
				workspacePath,
				name: undefined,
				firstMessage: "开始",
				messageCount: messages.length,
				modifiedAt: "2026-07-27T00:00:01.000Z",
			},
			messages,
		},
	};
}

test("SessionView 缓存并合并相邻工具调用", () => {
	const messages: PiSessionMessage[] = [
		{ role: "user", content: [{ type: "text", text: "开始" }], timestamp: 0 },
		assistant("read-1", "先读取文件"),
		toolResult("read-1"),
		assistant("read-2"),
		toolResult("read-2"),
	];
	const snapshot = { openedSession: openedSession(messages) };
	const view = new SessionView({ getSnapshot: () => snapshot } as ChatSession);
	const items = view.items;
	expect(items).toBe(view.items);
	expect(items.map((item) => item.type)).toEqual(["user", "assistant", "tool-section"]);
	const section = items[2];
	if (section.type !== "tool-section") throw new Error("预期最后一项为工具章节。");
	expect(section.sectionKey).toBe("tool-section-1-3-read-1-read-2");
	expect(section.toolCalls.map((toolCall) => ({
		id: toolCall.id,
		ownerMessageIndex: toolCall.ownerMessageIndex,
		resultMessageIndex: toolCall.resultMessageIndex,
		output: toolCall.output,
	}))).toEqual([
		{
			id: "read-1",
			ownerMessageIndex: 1,
			resultMessageIndex: 2,
			output: "result:read-1",
		},
		{
			id: "read-2",
			ownerMessageIndex: 3,
			resultMessageIndex: 4,
			output: "result:read-2",
		},
	]);
});

test("SessionView 保留用户消息中的图片内容", () => {
	const image = { type: "image", data: "aW1hZ2U=", mimeType: "image/webp" } as const;
	const snapshot = {
		openedSession: openedSession([{
			role: "user",
			content: [{ type: "text", text: "分析图片" }, image],
			timestamp: 0,
		}]),
	};
	const view = new SessionView({ getSnapshot: () => snapshot } as ChatSession);
	const item = view.items[0];
	if (item.type !== "user") throw new Error("预期用户消息。");
	expect(item.text).toBe("分析图片");
	expect(item.images).toEqual([image]);
});

test("OAuth 错误按错误类型而不是 provider 名分类", () => {
	const messages: PiSessionMessage[] = [{
		api: "test",
		provider: "openai",
		model: "test",
		role: "assistant",
		content: [],
		stopReason: "error",
		errorMessage: "OAuth refresh failed for openai",
		timestamp: 1,
		usage,
	}];
	const snapshot = { openedSession: openedSession(messages) };
	const view = new SessionView({ getSnapshot: () => snapshot } as ChatSession);
	const item = view.items[0];
	if (item.type !== "assistant") throw new Error("预期错误 assistant 消息。");
	expect(item.text).toContain("模型登录已失效");
});
