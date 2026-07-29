import {
	type AgentSession,
	type AgentSessionServices,
	sessionEntryToContextMessages,
	type SessionEntry,
	type SessionInfo,
} from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Model, UserMessage } from "@earendil-works/pi-ai";
import type {
	PiModel,
	PiOpenedSession,
	PiSessionMessage,
	PiSessionTranscriptEntry,
	PiSessionRuntimeState,
	PiSessionSummary,
} from "@shared/pi-contract";

export function createPiOpenedSession(options: {
	baseInfo?: SessionInfo;
	path: string;
	services: AgentSessionServices;
	session: AgentSession;
	workspacePath: string;
}): PiOpenedSession {
	const { baseInfo, path, services, session, workspacePath } = options;
	const contextEntries = session.sessionManager.buildContextEntries();
	const entries = toPiSessionTranscriptEntries(contextEntries);
	return {
		transcript: {
			session: {
				id: session.sessionId,
				path,
				workspacePath,
				name: session.sessionName,
				firstMessage: baseInfo?.firstMessage ?? getFirstUserMessageText(contextEntries),
				messageCount: Math.max(
					baseInfo?.messageCount ?? 0,
					session.sessionManager.getEntries().length,
				),
				modifiedAt: baseInfo?.modified.toISOString() ?? new Date().toISOString(),
			},
			entries,
		},
		runtime: createPiSessionRuntimeState(session, services, path),
	};
}

export function toPiSessionSummary(session: SessionInfo): PiSessionSummary {
	return {
		id: session.id,
		path: session.path,
		workspacePath: session.cwd,
		name: session.name,
		firstMessage: session.firstMessage,
		messageCount: session.messageCount,
		modifiedAt: session.modified.toISOString(),
	};
}

export function isPiSessionTranscriptEntry(entry: SessionEntry): boolean {
	if (entry.type === "message") {
		return entry.message.role !== "custom" || entry.message.display;
	}
	if (entry.type === "custom_message") return entry.display;
	return entry.type === "branch_summary" ? Boolean(entry.summary) : entry.type === "compaction";
}

export function getFirstUserMessageText(entries: readonly SessionEntry[]): string {
	for (const entry of entries) {
		if (entry.type === "message" && entry.message.role === "user") {
			return messageContentToText(entry.message.content);
		}
	}
	return "";
}

export function toPiSessionTranscriptEntries(
	entries: readonly SessionEntry[],
): PiSessionTranscriptEntry[] {
	const result: PiSessionTranscriptEntry[] = [];
	for (const entry of entries) {
		for (const message of sessionEntryToContextMessages(entry)) {
			const projected = toPiSessionMessage(message);
			if (projected) result.push({ id: entry.id, parentId: entry.parentId, message: projected });
		}
	}
	return result;
}

function toPiSessionMessage(message: AgentMessage): PiSessionMessage | null {
	if (message.role === "custom") {
		return message.display ? omitProperty(message, "details") : null;
	}
	if (message.role === "toolResult") return omitProperty(message, "details");
	if (message.role === "assistant") return omitProperty(message, "diagnostics");
	return message;
}

export function createPiSessionRuntimeState(
	session: AgentSession,
	services: AgentSessionServices,
	path: string,
): PiSessionRuntimeState {
	return {
		sessionId: session.sessionId,
		sessionPath: path,
		isStreaming: session.isStreaming,
		sessionName: session.sessionName,
		model: session.model ? toPiModel(session.model) : undefined,
		models: services.modelRuntime.getModels().map(toPiModel),
		thinkingLevel: session.thinkingLevel,
		availableThinkingLevels: session.getAvailableThinkingLevels(),
	};
}

function toPiModel(model: Model<any>): PiModel {
	return {
		contextWindow: model.contextWindow,
		id: model.id,
		name: model.name,
		provider: model.provider,
		input: model.input,
		reasoning: model.reasoning,
	};
}


function omitProperty<Value extends object, Key extends keyof Value>(
	value: Value,
	key: Key,
): Omit<Value, Key> {
	const result: Partial<Value> = { ...value };
	delete result[key];
	return result as Omit<Value, Key>;
}


function messageContentToText(content: UserMessage["content"]): string {
	if (typeof content === "string") return content;
	return content
		.map((block) => block.type === "text" ? block.text : "[图片]")
		.filter(Boolean)
		.join("\n");
}
