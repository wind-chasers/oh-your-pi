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
