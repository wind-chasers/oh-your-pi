import { resolve } from "node:path";
import { SessionManager, type AgentSession } from "@earendil-works/pi-coding-agent";
import type { PiSessionHostState } from "@main/pi/runtime";
import {
	PiOpenedSessionSchema,
	PiSessionRuntimeStateSchema,
	type PiOpenedSession,
	type PiSessionRuntimeState,
	type PiSessionSummary,
} from "@shared/pi-contract";
import { toConversationEntry, toPiModel, toSessionSummary } from "@main/workspace/mapper";

export async function toOpenedSession(runtime: PiSessionHostState, workspacePath: string): Promise<PiOpenedSession> {
	const sessionPath = requireSessionPath(runtime.session);
	const sessions = await SessionManager.list(workspacePath);
	const session = sessions.find((candidate) => resolve(candidate.path) === resolve(sessionPath));
	const summary = session ? toSessionSummary(session) : toRuntimeSummary(runtime, workspacePath);
	const sessionManager = runtime.session.sessionManager;

	return PiOpenedSessionSchema.parse({
		runtime: toRuntimeState(runtime, runtime.session),
		transcript: {
			session: summary,
			entries: sessionManager.getBranch().flatMap(toConversationEntry),
		},
	});
}

export function toRuntimeState(runtime: PiSessionHostState, session: AgentSession): PiSessionRuntimeState {
	return PiSessionRuntimeStateSchema.parse({
		sessionId: session.sessionId,
		sessionPath: requireSessionPath(session),
		isStreaming: session.isStreaming,
		sessionName: session.sessionName ?? null,
		model: session.model ? toPiModel(session.model) : null,
		models: runtime.services.modelRuntime.getModels().map(toPiModel),
		thinkingLevel: session.thinkingLevel,
		availableThinkingLevels: session.getAvailableThinkingLevels(),
	});
}


export function requireSessionPath(session: AgentSession): string {
	if (!session.sessionFile) throw new Error("Pi 未创建持久化会话文件。");
	return session.sessionFile;
}


function toRuntimeSummary(runtime: PiSessionHostState, workspacePath: string): PiSessionSummary {
	const session = runtime.session;
	return {
		id: session.sessionId,
		path: requireSessionPath(session),
		workspacePath,
		name: session.sessionName ?? null,
		firstMessage: "",
		messageCount: session.sessionManager.getEntries().length,
		modifiedAt: new Date().toISOString(),
	};
}
