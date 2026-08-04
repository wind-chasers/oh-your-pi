import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, mock, test } from "bun:test";
import {
	type AgentSession,
	type AgentSessionEvent,
	type AgentSessionServices,
	type PromptOptions,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import {
	navigateToUserMessageForRegeneration,
	PiSession,
	type PiSessionEvent,
	submitSessionPrompt,
} from "./session";

test("在 Pi 接受 prompt 后立即返回，不等待完整回复", async () => {
	let completeRun: (() => void) | undefined;
	const images: NonNullable<PromptOptions["images"]> = [
		{ type: "image", data: "aW1hZ2U=", mimeType: "image/webp" },
	];
	let submittedImages: PromptOptions["images"];
	const session = {
		prompt: (_text: string, options?: PromptOptions) => {
			submittedImages = options?.images;
			options?.preflightResult?.(true);
			const { promise, resolve } = Promise.withResolvers<void>();
			completeRun = resolve;
			return promise;
		},
	};

	await submitSessionPrompt(session, "Reply with exactly OK.", images, () => {
		throw new Error("不应在成功流式运行时报告错误。");
	}).accepted;
	expect(completeRun).toBeDefined();
	expect(submittedImages).toEqual(images);
	completeRun?.();
});

test("Pi 在接受前拒绝 prompt 时向调用方报告失败", async () => {
	const rejection = new Error("authentication failed");
	const reported: Error[] = [];
	const session = {
		prompt: (_text: string, options?: PromptOptions) => {
			options?.preflightResult?.(false);
			return Promise.reject(rejection);
		},
	};

	await expect(submitSessionPrompt(session, "hello", undefined, (error) => reported.push(error)).accepted)
		.rejects.toThrow("Pi 未接受这条消息。");
	await Promise.resolve();
	expect(reported).toEqual([rejection]);
});

test("中止运行前清空 steer 与 follow-up 队列", async () => {
	const calls: string[] = [];
	const clearQueue = mock(() => {
		calls.push("clear");
		return { steering: [], followUp: [] };
	});
	const abort = mock(async () => {
		calls.push("abort");
	});
	type SessionInternals = { agentSession: AgentSession };
	const SessionConstructor = PiSession as unknown as new (options: never) => PiSession;
	const session = new SessionConstructor({} as never);
	(session as unknown as SessionInternals).agentSession = { clearQueue, abort } as unknown as AgentSession;

	await session.abort();

	expect(calls).toEqual(["clear", "abort"]);
});

test("压缩前清空队列，完成后发布会话变化", async () => {
	const calls: string[] = [];
	const clearQueue = mock(() => {
		calls.push("clear");
		return { steering: [], followUp: [] };
	});
	const compact = mock(async () => {
		calls.push("compact");
	});
	type SessionInternals = {
		agentSession: AgentSession;
		publishTranscriptChanges(session: AgentSession): void;
	};
	const SessionConstructor = PiSession as unknown as new (options: never) => PiSession;
	const session = new SessionConstructor({} as never);
	const agentSession = { clearQueue, compact } as unknown as AgentSession;
	const internals = session as unknown as SessionInternals;
	internals.agentSession = agentSession;
	internals.publishTranscriptChanges = mock(() => calls.push("publish"));

	await session.compact();

	expect(calls).toEqual(["clear", "compact", "publish"]);
});

test("复制活动分支会创建独立的持久化会话", async () => {
	const directory = await mkdtemp(join(tmpdir(), "oh-your-pi-session-"));
	try {
		const manager = SessionManager.create(directory, directory);
		const userId = manager.appendMessage({ role: "user", content: "开始", timestamp: 0 });
		const assistantId = manager.appendMessage({
			api: "test",
			provider: "test",
			model: "test",
			role: "assistant",
			content: [{ type: "text", text: "回答" }],
			stopReason: "stop",
			timestamp: 1,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
		});
		const sourcePath = manager.getSessionFile();
		if (!sourcePath) throw new Error("Expected persisted source session");
		type SessionInternals = { agentSession: AgentSession; sessionPath: string };
		const SessionConstructor = PiSession as unknown as new (options: never) => PiSession;
		const session = new SessionConstructor({} as never);
		const internals = session as unknown as SessionInternals;
		internals.agentSession = { sessionManager: manager } as AgentSession;
		internals.sessionPath = sourcePath;

		const clone = session.createClonedSessionManager();

		expect(clone.getSessionFile()).not.toBe(sourcePath);
		expect(clone.getEntries().map((entry) => entry.id)).toEqual([userId, assistantId]);
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
});

test("重新生成会从历史用户消息的父节点创建分支", async () => {
	const navigateTree = mock(async () => ({ cancelled: false }));
	const entry = {
		id: "user-entry",
		message: { role: "user", content: "原消息", timestamp: 0 },
		parentId: "parent-entry",
		timestamp: new Date(0).toISOString(),
		type: "message",
	} as const;
	const session = {
		navigateTree,
		sessionManager: {
			getEntry: (entryId: string) => entryId === entry.id ? entry : undefined,
			getLeafId: () => "assistant-entry",
		},
	} as unknown as Parameters<typeof navigateToUserMessageForRegeneration>[0];

	await navigateToUserMessageForRegeneration(session, entry.id);
	expect(navigateTree).toHaveBeenCalledWith(entry.id, { summarize: false });
});

test("重新生成只接受有后续回复的历史用户消息", async () => {
	const assistantEntry = {
		id: "assistant-entry",
		message: { role: "assistant" },
		type: "message",
	};
	const invalidRoleSession = {
		navigateTree: async () => ({ cancelled: false }),
		sessionManager: {
			getEntry: () => assistantEntry,
			getLeafId: () => assistantEntry.id,
		},
	} as unknown as Parameters<typeof navigateToUserMessageForRegeneration>[0];
	await expect(navigateToUserMessageForRegeneration(invalidRoleSession, assistantEntry.id))
		.rejects.toThrow("不是该会话中的用户消息");

	const currentUserSession = {
		navigateTree: async () => ({ cancelled: false }),
		sessionManager: {
			getEntry: () => ({ ...assistantEntry, message: { role: "user" } }),
			getLeafId: () => assistantEntry.id,
		},
	} as unknown as Parameters<typeof navigateToUserMessageForRegeneration>[0];
	await expect(navigateToUserMessageForRegeneration(currentUserSession, assistantEntry.id))
		.rejects.toThrow("尚无后续回复");
});

test("Pi 扩展取消树导航时不会提交编辑后的消息", async () => {
	const session = {
		navigateTree: async () => ({ cancelled: true }),
		sessionManager: {
			getEntry: () => ({ id: "user-entry", message: { role: "user" }, type: "message" }),
			getLeafId: () => "assistant-entry",
		},
	} as unknown as Parameters<typeof navigateToUserMessageForRegeneration>[0];
	await expect(navigateToUserMessageForRegeneration(session, "user-entry"))
		.rejects.toThrow("取消了历史消息编辑");
});

test("重新生成在 Pi 拒绝 prompt 时恢复原分支", async () => {
	type SessionInternals = {
		agentSession: AgentSession;
		services: AgentSessionServices;
		sessionPath: string;
	};
	const SessionConstructor = PiSession as unknown as new (options: never) => PiSession;
	const session = new SessionConstructor({} as never);
	const manager = SessionManager.inMemory();
	const userId = manager.appendMessage({ role: "user", content: "原问题", timestamp: 0 });
	const assistantId = manager.appendMessage({
		api: "test",
		provider: "test",
		model: "test",
		role: "assistant",
		content: [{ type: "text", text: "原回答" }],
		stopReason: "stop",
		timestamp: 1,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
	});
	const navigateTree = mock(async (entryId: string) => {
		const entry = manager.getEntry(entryId);
		if (!entry) throw new Error("entry not found");
		if (entry.type === "message" && entry.message.role === "user") {
			if (entry.parentId) manager.branch(entry.parentId);
			else manager.resetLeaf();
		} else {
			manager.branch(entryId);
		}
		return { cancelled: false };
	});
	const agentSession = {
		sessionManager: manager,
		navigateTree,
		prompt: (_text: string, options?: PromptOptions) => {
			options?.preflightResult?.(false);
			return Promise.reject(new Error("prompt rejected"));
		},
		sessionFile: "/tmp/session.jsonl",
		sessionId: "session-id",
		sessionName: undefined,
		isStreaming: false,
		model: undefined,
		thinkingLevel: "off",
		getAvailableThinkingLevels: () => ["off"],
	} as unknown as AgentSession;
	const internals = session as unknown as SessionInternals;
	internals.agentSession = agentSession;
	internals.services = { modelRuntime: { getModels: () => [] } } as unknown as AgentSessionServices;
	internals.sessionPath = "/tmp/session.jsonl";

	await expect(session.regenerate("regenerate-1", userId, "修改后的问题")).rejects.toThrow("Pi 未接受这条消息");
	expect(manager.getLeafId()).toBe(assistantId);
	expect(navigateTree).toHaveBeenNthCalledWith(1, userId, { summarize: false });
	expect(navigateTree).toHaveBeenNthCalledWith(2, assistantId, { summarize: false });
});

test("用户消息持久化后发布 committed entry，分支变化发布 rebase", async () => {
	type SessionInternals = {
		agentSession: AgentSession;
		handleAgentEvent(session: AgentSession, event: AgentSessionEvent): void;
		publishTranscriptChanges(session: AgentSession): void;
		regenerationId: string | undefined;
	};
	const SessionConstructor = PiSession as unknown as new (options: never) => PiSession;
	const session = new SessionConstructor({} as never);
	const manager = SessionManager.inMemory();
	const agentSession = { sessionManager: manager } as AgentSession;
	const internals = session as unknown as SessionInternals;
	internals.agentSession = agentSession;
	const events: PiSessionEvent[] = [];
	session.subscribe((event) => events.push(event));

	const message = { role: "user", content: "开始", timestamp: 0 } as const;
	internals.handleAgentEvent(agentSession, { type: "message_end", message });
	const entryId = manager.appendMessage(message);
	await Promise.resolve();
	expect(events[events.length - 1]).toEqual({
		firstMessage: "开始",
		messageCount: 1,
		modifiedAt: manager.getEntry(entryId)!.timestamp,
		type: "transcript_entries_appended",
		entries: [{ id: entryId, parentId: null, message }],
		confirmedInputs: [],
	});
	const assistant = {
		api: "test",
		provider: "test",
		model: "test",
		role: "assistant" as const,
		content: [{ type: "text" as const, text: "回答" }],
		stopReason: "stop" as const,
		timestamp: 1,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
	};
	const assistantId = manager.appendMessage(assistant);
	const oldTail = { role: "user", content: "旧分支", timestamp: 2 } as const;
	manager.appendMessage(oldTail);
	internals.publishTranscriptChanges(agentSession);

	internals.regenerationId = "regenerate-1";
	manager.branch(assistantId);
	const alternate = { role: "user", content: "另一条分支", timestamp: 3 } as const;
	const alternateId = manager.appendMessage(alternate);
	internals.publishTranscriptChanges(agentSession);
	expect(events[events.length - 1]).toEqual({
		firstMessage: "开始",
		messageCount: 4,
		modifiedAt: manager.getEntry(alternateId)!.timestamp,
		type: "transcript_rebased",
		replaceFrom: 2,
		entries: [{ id: alternateId, parentId: assistantId, message: alternate }],
		confirmedInputs: [{ clientId: "regenerate-1", entryId: alternateId }],
	});
});

test("重复 queued user 批量持久化时仍精确关联 clientId", async () => {
	type SessionInternals = {
		agentSession: AgentSession;
		handleAgentEvent(session: AgentSession, event: AgentSessionEvent): void;
	};
	const SessionConstructor = PiSession as unknown as new (options: never) => PiSession;
	const session = new SessionConstructor({} as never);
	const manager = SessionManager.inMemory();
	let steering: string[] = [];
	const internals = session as unknown as SessionInternals;
	const agentSession = {
		sessionManager: manager,
		getSteeringMessages: () => steering,
		getFollowUpMessages: () => [],
		steer: async (text: string) => {
			steering = [...steering, text];
			internals.handleAgentEvent(agentSession as AgentSession, {
				type: "queue_update",
				steering,
				followUp: [],
			});
		},
	} as unknown as AgentSession;
	internals.agentSession = agentSession;
	const events: PiSessionEvent[] = [];
	session.subscribe((event) => events.push(event));

	await session.steer("s1", "调整方向");
	await session.steer("s2", "调整方向");

	const firstMessage = { role: "user", content: "调整方向", timestamp: 10 } as const;
	steering = ["调整方向"];
	internals.handleAgentEvent(agentSession, { type: "queue_update", steering, followUp: [] });
	internals.handleAgentEvent(agentSession, { type: "message_start", message: firstMessage });
	internals.handleAgentEvent(agentSession, { type: "message_end", message: firstMessage });
	const firstEntryId = manager.appendMessage(firstMessage);

	const secondMessage = { role: "user", content: "调整方向", timestamp: 11 } as const;
	steering = [];
	internals.handleAgentEvent(agentSession, { type: "queue_update", steering, followUp: [] });
	internals.handleAgentEvent(agentSession, { type: "message_start", message: secondMessage });
	internals.handleAgentEvent(agentSession, { type: "message_end", message: secondMessage });
	const secondEntryId = manager.appendMessage(secondMessage);
	await Promise.resolve();

	const transcriptEvent = [...events].reverse().find((event) => event.type === "transcript_entries_appended");
	expect(transcriptEvent).toMatchObject({
		type: "transcript_entries_appended",
		confirmedInputs: [
			{ clientId: "s1", entryId: firstEntryId },
			{ clientId: "s2", entryId: secondEntryId },
		],
	});
});
