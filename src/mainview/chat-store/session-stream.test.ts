import { expect, test } from "bun:test";
import type {
	PiOpenedSession,
	PiSessionEvent,
	PiToolPermissionRequest,
} from "@shared/pi-contract";
import { SessionSnapshot } from "./snapshot";
import { SessionStream } from "./session-stream";
import type {
	ChatLiveAgentTail,
	ChatPendingUserMessage,
	ChatQueuedUserInput,
	ChatSessionSnapshot,
} from "./types";

const workspacePath = "/workspace";
const sessionId = "session-id";
const sessionPath = "/workspace/session.jsonl";

function openedSession(): PiOpenedSession {
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
				messageCount: 0,
				modifiedAt: "2026-07-29T00:00:00.000Z",
			},
			entries: [],
		},
	};
}

function createSessionSnapshot(): SessionSnapshot {
	const snapshot = new SessionSnapshot(workspacePath, sessionId, sessionPath);
	snapshot.edit((draft) => {
		draft.phase = "ready";
		draft.openedSession = openedSession();
	});
	return snapshot;
}

function pendingMessage(text: string, clientId = "client-1"): ChatPendingUserMessage {
	return { clientId, text, images: [] };
}

function requireLiveOutput(value: ChatSessionSnapshot): ChatLiveAgentTail {
	if (value.transient.tail.type !== "live-agent") throw new Error("预期存在实时 agent 输出");
	return value.transient.tail.output;
}

type SessionEventInput<T> = T extends PiSessionEvent ? Omit<T, "sessionPath"> : never;

function event(value: SessionEventInput<PiSessionEvent>): PiSessionEvent {
	return { ...value, sessionPath } as PiSessionEvent;
}

function createSubject(): {
	snapshot: SessionSnapshot;
	stream: SessionStream;
} {
	const snapshot = createSessionSnapshot();
	return { snapshot, stream: new SessionStream(snapshot) };
}

test("SessionStream 通过注入实例更新唯一的视图快照", () => {
	const { snapshot, stream } = createSubject();
	stream.acceptEvent(event({ type: "agent_start" }));

	stream.acceptEvent(event({
		type: "tool_execution_start",
		toolCallId: "tool-1",
		toolName: "read",
	}));
	const started = snapshot.get();
	stream.acceptEvent(event({
		type: "tool_execution_end",
		toolCallId: "tool-1",
		toolName: "read",
		isError: false,
	}));
	const completed = snapshot.get();

	expect(requireLiveOutput(started).tools[0]?.executionStatus).toBe("running");
	expect(requireLiveOutput(completed).tools[0]?.executionStatus).toBe("completed");
	expect(requireLiveOutput(started).tools).not.toBe(requireLiveOutput(completed).tools);

	const request: PiToolPermissionRequest = {
		id: "permission-1",
		sessionPath,
		toolCallId: "tool-2",
		toolName: "write",
		title: "写入文件",
		message: "允许写入吗？",
		isDangerous: true,
	};
	stream.acceptPermission(request);
	const pending = snapshot.get();
	stream.resolvePermission(request, false);
	const denied = snapshot.get();

	expect(requireLiveOutput(pending).permissionRequests).toEqual([request]);
	expect(requireLiveOutput(denied).permissionRequests).toEqual([]);
	expect(requireLiveOutput(pending).permissionRequests).not.toBe(
		requireLiveOutput(denied).permissionRequests,
	);
	expect(requireLiveOutput(denied).tools.find((tool) => tool.id === "tool-2")).toMatchObject({
		executionStatus: "completed",
		isError: true,
		output: "用户拒绝执行此工具调用。",
	});
});

test("终止后到达的权限响应不会重建 live tail", () => {
	const { snapshot, stream } = createSubject();
	const request: PiToolPermissionRequest = {
		id: "permission-1",
		sessionPath,
		toolCallId: "tool-1",
		toolName: "write",
		title: "写入文件",
		message: "允许写入吗？",
		isDangerous: true,
	};
	stream.acceptEvent(event({ type: "agent_start" }));
	stream.acceptPermission(request);
	stream.finishAbort();
	stream.resolvePermission(request, true);
	const resolved = snapshot.get();

	expect(resolved.transient.tail).toEqual({ type: "empty" });
	expect(resolved.openedSession?.runtime.isStreaming).toBeFalse();
});

test("SessionStream 用 committed entries 替换 optimistic user 与实时输出", () => {
	const { snapshot, stream } = createSubject();
	stream.beginPrompt(pendingMessage("继续"));
	expect(snapshot.get().transient.tail).toMatchObject({
		type: "optimistic-user",
		message: { text: "继续" },
	});

	const userEntry = {
		id: "user-1",
		parentId: null,
		message: { role: "user" as const, content: "继续", timestamp: 1 },
	};
	stream.acceptEvent(event({
		type: "transcript_entries_appended",
		entries: [userEntry],
		confirmedInputs: [],
		firstMessage: "继续",
		messageCount: 1,
		modifiedAt: "2026-07-29T00:00:01.000Z",
	}));
	const confirmed = snapshot.get();
	expect(confirmed.transient.tail.type).toBe("live-agent");
	expect(confirmed.openedSession?.transcript.entries).toEqual([userEntry]);

	stream.acceptEvent(event({ type: "text_delta", delta: "结果" }));
	stream.acceptEvent(event({ type: "agent_settled" }));
	const settled = snapshot.get();
	expect(requireLiveOutput(settled)).toMatchObject({
		phase: "settled-awaiting-commit",
		text: "结果",
	});

	const assistantEntry = {
		id: "assistant-1",
		parentId: userEntry.id,
		message: {
			api: "test",
			provider: "test",
			model: "test",
			role: "assistant" as const,
			content: [{ type: "text" as const, text: "结果" }],
			stopReason: "stop" as const,
			timestamp: 2,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
		},
	};
	stream.acceptEvent(event({
		type: "transcript_entries_appended",
		entries: [assistantEntry],
		confirmedInputs: [],
		messageCount: 2,
		firstMessage: "继续",
		modifiedAt: "2026-07-29T00:00:02.000Z",
	}));
	const committed = snapshot.get();
	expect(committed.transient.tail).toEqual({ type: "empty" });
	expect(committed.openedSession?.transcript.entries).toEqual([userEntry, assistantEntry]);
});

test("SessionStream 按 Pi 交付顺序确认 steer 与 follow-up", () => {
	const { snapshot, stream } = createSubject();
	stream.acceptEvent(event({ type: "agent_start" }));
	const steer: ChatQueuedUserInput = {
		state: "submitting",
		message: pendingMessage("调整", "steer-1"),
	};
	const followUp: ChatQueuedUserInput = {
		state: "submitting",
		message: pendingMessage("总结", "follow-up-1"),
	};
	snapshot.transaction(() => {
		stream.beginQueuedInput("followUps", followUp);
		stream.beginQueuedInput("steering", steer);
		stream.acceptQueuedInput(steer.message.clientId);
		stream.acceptQueuedInput(followUp.message.clientId);
	});
	const current = snapshot.get();
	expect(current.transient.queuedInputs.steering.map((input) => input.state)).toEqual(["queued"]);
	expect(current.transient.queuedInputs.followUps.map((input) => input.state)).toEqual(["queued"]);

	stream.acceptEvent(event({
		type: "transcript_entries_appended",
		entries: [{
			id: "steer-entry",
			parentId: null,
			message: { role: "user", content: "调整", timestamp: 1 },
		}],
		confirmedInputs: [{ clientId: "steer-1", entryId: "steer-entry" }],
		firstMessage: "调整",
		messageCount: 1,
		modifiedAt: "2026-07-29T00:00:01.000Z",
	}));
	const committedSteer = snapshot.get();
	expect(committedSteer.transient.queuedInputs.steering).toEqual([]);
	expect(committedSteer.transient.queuedInputs.followUps).toHaveLength(1);

	stream.acceptEvent(event({
		type: "transcript_entries_appended",
		entries: [{
			id: "follow-up-entry",
			parentId: "steer-entry",
			message: { role: "user", content: "总结", timestamp: 2 },
		}],
		confirmedInputs: [{ clientId: "follow-up-1", entryId: "follow-up-entry" }],
		firstMessage: "调整",
		messageCount: 2,
		modifiedAt: "2026-07-29T00:00:02.000Z",
	}));
	const committedFollowUp = snapshot.get();
	expect(committedFollowUp.transient.queuedInputs).toEqual({ steering: [], followUps: [] });
});

test("SessionStream rebase 只替换变化尾部并保留公共前缀", () => {
	const entries = [
		{ id: "A", parentId: null, message: { role: "user" as const, content: "A", timestamp: 1 } },
		{ id: "B", parentId: "A", message: { role: "user" as const, content: "B", timestamp: 2 } },
		{ id: "C", parentId: "B", message: { role: "user" as const, content: "C", timestamp: 3 } },
	];
	const { snapshot: sessionSnapshot, stream } = createSubject();
	sessionSnapshot.edit((draft) => {
		if (!draft.openedSession) throw new Error("预期已打开会话");
		draft.openedSession.transcript.entries = entries;
	});
	const replacement = {
		id: "X",
		parentId: "B",
		message: { role: "user" as const, content: "X", timestamp: 4 },
	};
	stream.acceptEvent(event({
		type: "transcript_rebased",
		replaceFrom: 2,
		entries: [replacement],
		confirmedInputs: [],
		firstMessage: "A",
		messageCount: 4,
		modifiedAt: "2026-07-29T00:00:04.000Z",
	}));
	const nextEntries = sessionSnapshot.get().openedSession?.transcript.entries ?? [];
	expect(nextEntries.map((entry) => entry.id)).toEqual(["A", "B", "X"]);
	expect(nextEntries[0]).toBe(entries[0]);
	expect(nextEntries[1]).toBe(entries[1]);
});
