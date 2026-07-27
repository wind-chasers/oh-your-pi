import { expect, test } from "bun:test";
import { ToolPermissionApplication } from "./permissions";

test("只读工具无需前端授权", async () => {
	const permissions = new ToolPermissionApplication();
	await expect(permissions.beforeToolCall({
		sessionPath: "/tmp/session.jsonl",
		toolCallId: "read-1",
		toolName: "read",
		input: { path: "README.md" },
	})).resolves.toEqual({ allowed: true });
});

test("工具授权响应只解析对应请求", async () => {
	const permissions = new ToolPermissionApplication();
	let requestId = "";
	permissions.subscribe((request) => {
		requestId = request.id;
	});
	const decision = permissions.beforeToolCall({
		sessionPath: "/tmp/session.jsonl",
		toolCallId: "bash-1",
		toolName: "bash",
		input: { command: "pwd" },
	});

	expect(requestId).not.toBe("");
	expect(permissions.respond({ id: requestId, allowed: true })).toEqual({ resolved: true });
	await expect(decision).resolves.toEqual({ allowed: true });
	expect(() => permissions.respond({ id: requestId, allowed: false })).toThrow("已失效");
});
