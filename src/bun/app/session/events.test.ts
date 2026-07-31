import { expect, test } from "bun:test";
import type { PiSessionEvent } from "@main/pi";
import { toAppSessionEvents } from "./events";

const sessionPath = "/workspace/session.jsonl";

test("工具事件保留 SDK 字段并移除不可传输 payload", () => {
	expect(toAppSessionEvents(sessionPath, {
		type: "tool_execution_start",
		toolCallId: "read-1",
		toolName: "read",
		args: { path: "secret.txt" },
	})).toEqual([{
		sessionPath,
		type: "tool_execution_start",
		toolCallId: "read-1",
		toolName: "read",
	}]);

	expect(toAppSessionEvents(sessionPath, {
		type: "tool_execution_end",
		toolCallId: "read-1",
		toolName: "read",
		result: { content: [{ type: "text", text: "done" }] },
		isError: false,
	})).toEqual([{
		sessionPath,
		type: "tool_execution_end",
		toolCallId: "read-1",
		toolName: "read",
		isError: false,
	}]);
});

test("只投影 Renderer 需要的增量与错误", () => {
	const textEvent = {
		type: "message_update",
		assistantMessageEvent: { type: "text_delta", delta: "hello" },
		message: {},
	} as PiSessionEvent;
	expect(toAppSessionEvents(sessionPath, textEvent)).toEqual([{
		sessionPath,
		type: "text_delta",
		delta: "hello",
	}]);

	expect(toAppSessionEvents(sessionPath, {
		type: "error",
		error: new Error("failed"),
	})).toEqual([{
		sessionPath,
		type: "error",
		errorMessage: "failed",
	}]);
});

test("持久 transcript 变更直接透传 entry 增量", () => {
	const entries = [{
		id: "entry-1",
		parentId: null,
		message: { role: "user" as const, content: "hello", timestamp: 0 },
	}];
	const update = {
		confirmedInputs: [],
		firstMessage: "hello",
		messageCount: 1,
		modifiedAt: "2026-07-29T00:00:00.000Z",
	};
	expect(toAppSessionEvents(sessionPath, {
		type: "transcript_entries_appended",
		entries,
		...update,
	})).toEqual([{
		sessionPath,
		type: "transcript_entries_appended",
		entries,
		...update,
	}]);
});

test("队列清理事件携带精确 clientId", () => {
	expect(toAppSessionEvents(sessionPath, {
		type: "queued_inputs_cleared",
		clientIds: ["s1", "f1"],
	})).toEqual([{
		sessionPath,
		type: "queued_inputs_cleared",
		clientIds: ["s1", "f1"],
	}]);
});

test("重新生成失败事件保留 clientId", () => {
	expect(toAppSessionEvents(sessionPath, {
		type: "regeneration_failed",
		clientId: "regenerate-1",
		error: new Error("没有生成用户消息"),
	})).toEqual([{
		sessionPath,
		type: "regeneration_failed",
		clientId: "regenerate-1",
		errorMessage: "没有生成用户消息",
	}]);
});
