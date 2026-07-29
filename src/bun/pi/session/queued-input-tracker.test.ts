import { expect, test } from "bun:test";
import type { AgentSessionEvent, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { ImageContent, UserMessage } from "@earendil-works/pi-ai";
import { QueuedInputTracker } from "./queued-input-tracker";

function queueUpdate(steering: string[], followUp: string[] = []): AgentSessionEvent {
	return { type: "queue_update", steering, followUp };
}

function userEvent(type: "message_start" | "message_end", message: UserMessage): AgentSessionEvent {
	return { type, message };
}

function entry(id: string, message: UserMessage, parentId: string | null = null): SessionEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: new Date(message.timestamp).toISOString(),
		message,
	};
}

test("重复文本按 FIFO 精确关联 clientId 与持久 entry", async () => {
	const tracker = new QueuedInputTracker();
	await tracker.enqueue("steering", "s1", async () => {
		tracker.acceptAgentEvent(queueUpdate(["相同文本"]));
	});
	await tracker.enqueue("steering", "s2", async () => {
		tracker.acceptAgentEvent(queueUpdate(["相同文本", "相同文本"]));
	});

	const first = { role: "user", content: "相同文本", timestamp: 1 } as const;
	tracker.acceptAgentEvent(queueUpdate(["相同文本"]));
	tracker.acceptAgentEvent(userEvent("message_start", first));
	tracker.acceptAgentEvent(userEvent("message_end", first));
	const second = { role: "user", content: "相同文本", timestamp: 1 } as const;
	tracker.acceptAgentEvent(queueUpdate([]));
	tracker.acceptAgentEvent(userEvent("message_start", second));
	tracker.acceptAgentEvent(userEvent("message_end", second));

	const clonedFirst = { ...first };
	expect(tracker.confirmPersistedEntries([entry("cloned-entry", clonedFirst)])).toEqual([]);

	expect(tracker.confirmPersistedEntries([
		entry("entry-1", first),
		entry("entry-2", second, "entry-1"),
	])).toEqual([
		{ clientId: "s1", entryId: "entry-1" },
		{ clientId: "s2", entryId: "entry-2" },
	]);
});

test("纯图片 steering/follow-up 无 removal event 时仍能确认并保持 shadow 对齐", async () => {
	const tracker = new QueuedInputTracker();
	const image: ImageContent = { type: "image", data: "aW1hZ2U=", mimeType: "image/png" };
	await tracker.enqueue("followUp", "f1", async () => {
		tracker.acceptAgentEvent(queueUpdate([], [""]));
	}, [image]);
	await tracker.enqueue("steering", "s1", async () => {
		tracker.acceptAgentEvent(queueUpdate([""], [""]));
	}, [image]);

	const steeringMessage: UserMessage = { role: "user", content: [image], timestamp: 1 };
	tracker.acceptAgentEvent(userEvent("message_start", steeringMessage));
	tracker.acceptAgentEvent(userEvent("message_end", steeringMessage));
	const followUpMessage: UserMessage = { role: "user", content: [image], timestamp: 2 };
	tracker.acceptAgentEvent(userEvent("message_start", followUpMessage));
	tracker.acceptAgentEvent(userEvent("message_end", followUpMessage));
	expect(tracker.confirmPersistedEntries([
		entry("steering-image", steeringMessage),
		entry("follow-up-image", followUpMessage, "steering-image"),
	])).toEqual([
		{ clientId: "s1", entryId: "steering-image" },
		{ clientId: "f1", entryId: "follow-up-image" },
	]);

	await tracker.enqueue("steering", "s2", async () => {
		tracker.acceptAgentEvent(queueUpdate(["", "next"], [""]));
	});
	const nextMessage = { role: "user", content: "next", timestamp: 3 } as const;
	tracker.acceptAgentEvent(queueUpdate([""], [""]));
	tracker.acceptAgentEvent(userEvent("message_start", nextMessage));
	tracker.acceptAgentEvent(userEvent("message_end", nextMessage));
	expect(tracker.confirmPersistedEntries([entry("next-entry", nextMessage)])).toEqual([
		{ clientId: "s2", entryId: "next-entry" },
	]);
});

test("外部队列项不会消费 Renderer clientId", async () => {
	const tracker = new QueuedInputTracker();
	tracker.reset(["extension"], []);
	await tracker.enqueue("steering", "s1", async () => {
		tracker.acceptAgentEvent(queueUpdate(["extension", "ours"]));
	});

	const extension = { role: "user", content: "extension", timestamp: 1 } as const;
	tracker.acceptAgentEvent(queueUpdate(["ours"]));
	tracker.acceptAgentEvent(userEvent("message_start", extension));
	tracker.acceptAgentEvent(userEvent("message_end", extension));
	expect(tracker.confirmPersistedEntries([entry("extension-entry", extension)])).toEqual([]);

	const ours = { role: "user", content: "ours", timestamp: 2 } as const;
	tracker.acceptAgentEvent(queueUpdate([]));
	tracker.acceptAgentEvent(userEvent("message_start", ours));
	tracker.acceptAgentEvent(userEvent("message_end", ours));
	expect(tracker.confirmPersistedEntries([entry("ours-entry", ours)])).toEqual([
		{ clientId: "s1", entryId: "ours-entry" },
	]);
});

test("clear 同时返回 steering 与 follow-up 的 clientIds", async () => {
	const tracker = new QueuedInputTracker();
	await tracker.enqueue("steering", "s1", async () => {
		tracker.acceptAgentEvent(queueUpdate(["steer"]));
	});
	await tracker.enqueue("followUp", "f1", async () => {
		tracker.acceptAgentEvent(queueUpdate(["steer"], ["follow-up"]));
	});

	const cleared = tracker.clear(() => {
		tracker.acceptAgentEvent(queueUpdate([], []));
	});

	expect(cleared).toEqual(["s1", "f1"]);
});
