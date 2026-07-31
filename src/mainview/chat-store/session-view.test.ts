import { expect, test } from "bun:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { PiOpenedSession, PiSessionMessage } from "@shared/pi-contract";
import type { SessionSnapshot } from "./snapshot";
import { getSessionViewItemKey, SessionView } from "./session-view";

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
			entries: messages.map((message, index) => ({
				id: `entry-${index}`,
				parentId: index === 0 ? null : `entry-${index - 1}`,
				message,
			})),
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
	const view = new SessionView({ get: () => snapshot } as SessionSnapshot);
	const items = view.items;
	expect(items).toBe(view.items);
	expect(items.map((item) => item.type)).toEqual(["user", "assistant", "tool-section"]);
	const section = items[2];
	if (section.type !== "tool-section") throw new Error("预期最后一项为工具章节。");
	expect(section.sectionKey).toBe("tool-section:entry-1:entry-3");
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
	const view = new SessionView({ get: () => snapshot } as SessionSnapshot);
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
	const view = new SessionView({ get: () => snapshot } as SessionSnapshot);
	const item = view.items[0];
	if (item.type !== "assistant") throw new Error("预期错误 assistant 消息。");
	expect(item.text).toContain("模型登录已失效");
});

test("SessionView 追加新一轮时保留历史 render item 引用", () => {
	const firstTurn = [
		{ role: "user" as const, content: "第一问", timestamp: 0 },
		{
			api: "test",
			provider: "test",
			model: "test",
			role: "assistant" as const,
			content: [{ type: "text" as const, text: "第一答" }],
			stopReason: "stop" as const,
			timestamp: 1,
			usage,
		},
	];
	let current = openedSession(firstTurn);
	const holder = { get: () => ({ openedSession: current }) } as SessionSnapshot;
	const view = new SessionView(holder);
	const historicalUser = view.items[0];
	const historicalAssistant = view.items[1];

	const previousEntries = current.transcript.entries;
	current = {
		...current,
		transcript: {
			...current.transcript,
			entries: [...previousEntries, {
				id: "entry-2",
				parentId: "entry-1",
				message: { role: "user", content: "第二问", timestamp: 2 },
			}],
		},
	};
	const appended = view.items;
	expect(appended[0]).toBe(historicalUser);
	expect(appended[1]).toBe(historicalAssistant);
	expect(getSessionViewItemKey(appended[2])).toBe("entry-2");
});

test("SessionView rebase 只重算变化尾部", () => {
	let current = openedSession([
		{ role: "user", content: "A", timestamp: 0 },
		{ role: "user", content: "B", timestamp: 1 },
		{ role: "user", content: "C", timestamp: 2 },
	]);
	const holder = { get: () => ({ openedSession: current }) } as SessionSnapshot;
	const view = new SessionView(holder);
	const previousItems = view.items;
	const previousEntries = current.transcript.entries;
	current = {
		...current,
		transcript: {
			...current.transcript,
			entries: [previousEntries[0], previousEntries[1], {
				id: "X",
				parentId: previousEntries[1].id,
				message: { role: "user", content: "X", timestamp: 3 },
			}],
		},
	};

	const rebasedItems = view.items;
	expect(rebasedItems.map(getSessionViewItemKey)).toEqual(["entry-0", "entry-1", "X"]);
	expect(rebasedItems[0]).toBe(previousItems[0]);
	expect(rebasedItems[1]).toBe(previousItems[1]);
	expect(rebasedItems[2]).not.toBe(previousItems[2]);
});
