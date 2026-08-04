import { expect, mock, test } from "bun:test";
import type { PiOpenedSession, PiSessionRuntimeState } from "@shared/pi-contract";
import type { PiRuntime, PiSession } from "@main/pi";
import type { AuthenticationApplication } from "@main/app/authentication";
import { SessionApplication } from ".";

const input = {
	clientId: "regenerate-1",
	sessionPath: "/tmp/session.jsonl",
	entryId: "user-entry",
	text: "修改后的问题",
};

function createApplication(
	session: Partial<PiSession>,
	workspace?: Record<string, unknown>,
) {
	const pi = {
		getSession: () => session as PiSession,
		openWorkspace: async () => workspace,
	} as unknown as PiRuntime;
	const withProviderOperation = mock(async (_provider: string, operation: () => Promise<unknown>) => operation());
	const authentication = { withProviderOperation } as unknown as AuthenticationApplication;
	return { application: new SessionApplication(pi, authentication), withProviderOperation };
}

test("历史消息重新生成在认证后复用 Pi 原生树分支", async () => {
	const requireResolvedAuthentication = mock(async () => {});
	const regenerate = mock(async () => {});
	const { application, withProviderOperation } = createApplication({
		isIdle: true,
		path: input.sessionPath,
		provider: "anthropic",
		regenerate,
		requireResolvedAuthentication,
	});

	await application.regenerate(input);
	expect(withProviderOperation).toHaveBeenCalledWith("anthropic", expect.any(Function));
	expect(requireResolvedAuthentication).toHaveBeenCalledTimes(1);
	expect(regenerate).toHaveBeenCalledWith(input.clientId, input.entryId, input.text, undefined);
	application.dispose();
});

test("运行中的会话不能修改历史消息", async () => {
	const regenerate = mock(async () => {});
	const { application } = createApplication({
		isIdle: false,
		path: input.sessionPath,
		provider: "anthropic",
		regenerate,
	});

	await expect(application.regenerate(input)).rejects.toThrow("Pi 正在运行");
	expect(regenerate).not.toHaveBeenCalled();
	application.dispose();
});

test("等待认证操作期间开始运行的会话不会被回退", async () => {
	let idleChecks = 0;
	const regenerate = mock(async () => {});
	const { application } = createApplication({
		get isIdle() {
			idleChecks += 1;
			return idleChecks === 1;
		},
		path: input.sessionPath,
		provider: "anthropic",
		regenerate,
		requireResolvedAuthentication: async () => {},
	});

	await expect(application.regenerate(input)).rejects.toThrow("Pi 正在运行");
	expect(regenerate).not.toHaveBeenCalled();
	application.dispose();
});

test("模型与思考设置只返回 runtime", async () => {
	const runtime = {
		sessionId: "session-id",
		sessionPath: input.sessionPath,
		isStreaming: false,
		sessionName: undefined,
		model: undefined,
		models: [],
		thinkingLevel: "off",
		availableThinkingLevels: ["off"],
	} satisfies PiSessionRuntimeState;
	const setModel = mock(async () => {});
	const setThinking = mock(() => {});
	const getRuntimeState = mock(() => runtime);
	const { application } = createApplication({
		isIdle: true,
		setModel,
		setThinking,
		getRuntimeState,
	});

	const modelResult = await application.setModel({
		sessionPath: input.sessionPath,
		provider: "anthropic",
		modelId: "claude",
	});
	const thinkingResult = await application.setThinking({
		sessionPath: input.sessionPath,
		thinkingLevel: "off",
	});

	expect(modelResult).toBe(runtime);
	expect(thinkingResult).toBe(runtime);
	expect(setModel).toHaveBeenCalledWith("anthropic", "claude");
	expect(setThinking).toHaveBeenCalledWith("off");
	expect(getRuntimeState).toHaveBeenCalledTimes(2);
	application.dispose();
});

test("复制和删除会话委托给所属工作区并返回新快照", async () => {
	const forkedSnapshot = {} as PiOpenedSession;
	const droppedSnapshot = {} as PiOpenedSession;
	const forkedSession = {
		getSnapshot: mock(() => forkedSnapshot),
		path: "/tmp/forked.jsonl",
		subscribe: mock(() => () => {}),
	};
	const droppedSession = {
		getSnapshot: mock(() => droppedSnapshot),
		path: "/tmp/replacement.jsonl",
		subscribe: mock(() => () => {}),
	};
	const workspace = {
		dropSession: mock(async () => droppedSession),
		forkSession: mock(async () => forkedSession),
	};
	const { application } = createApplication({}, workspace);
	const request = { sessionPath: input.sessionPath, workspacePath: "/tmp" };

	expect(await application.fork(request)).toBe(forkedSnapshot);
	expect(await application.drop(request)).toBe(droppedSnapshot);
	expect(workspace.forkSession).toHaveBeenCalledWith(input.sessionPath, expect.any(Object));
	expect(workspace.dropSession).toHaveBeenCalledWith(input.sessionPath, expect.any(Object));
	application.dispose();
});

test("压缩会话复用认证保护并返回最新运行态", async () => {
	const runtime = {
		sessionId: "session-id",
		sessionPath: input.sessionPath,
		isStreaming: false,
		sessionName: undefined,
		model: undefined,
		models: [],
		thinkingLevel: "off",
		availableThinkingLevels: ["off"],
	} satisfies PiSessionRuntimeState;
	const compact = mock(async () => {});
	const requireResolvedAuthentication = mock(async () => {});
	const getRuntimeState = mock(() => runtime);
	const { application, withProviderOperation } = createApplication({
		compact,
		getRuntimeState,
		provider: "anthropic",
		requireResolvedAuthentication,
	});

	expect(await application.compact({ sessionPath: input.sessionPath })).toBe(runtime);
	expect(withProviderOperation).toHaveBeenCalledWith("anthropic", expect.any(Function));
	expect(requireResolvedAuthentication).toHaveBeenCalledTimes(1);
	expect(compact).toHaveBeenCalledTimes(1);
	application.dispose();
});
