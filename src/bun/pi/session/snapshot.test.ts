import { expect, test } from "bun:test";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { toPiSessionMessages } from "./snapshot";

const usage = {
	cacheRead: 0,
	cacheWrite: 0,
	cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
	input: 0,
	output: 0,
	totalTokens: 0,
};

test("直接保留 Pi 消息并移除 arbitrary details", () => {
	const messages: AgentMessage[] = [
		{
			api: "test",
			content: [
				{ type: "text", text: "我先读取配置。" },
				{ type: "toolCall", id: "read-1", name: "read", arguments: { path: "config.json" } },
			],
			diagnostics: [{ type: "test", timestamp: 0, details: { runtimeOnly: true } }],
			model: "test",
			provider: "test",
			role: "assistant",
			stopReason: "toolUse",
			timestamp: 0,
			usage,
		},
		{
			content: [{ type: "text", text: "{\"ready\":true}" }],
			details: { runtimeOnly: true },
			isError: false,
			role: "toolResult",
			timestamp: 1,
			toolCallId: "read-1",
			toolName: "read",
		},
		{
			role: "custom",
			customType: "hidden",
			content: "hidden",
			display: false,
			details: { internal: true },
			timestamp: 2,
		},
	];

	const result = toPiSessionMessages(messages);
	expect(result).toHaveLength(2);
	expect(() => JSON.stringify(result)).not.toThrow();
	expect("diagnostics" in result[0]).toBe(false);
	expect(result[1]).toEqual({
		content: [{ type: "text", text: "{\"ready\":true}" }],
		isError: false,
		role: "toolResult",
		timestamp: 1,
		toolCallId: "read-1",
		toolName: "read",
	});
});
