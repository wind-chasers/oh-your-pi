import type {
	AgentSession,
	AgentSessionServices,
	SessionInfo,
} from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Model, UserMessage } from "@earendil-works/pi-ai";
import type {
	PiModel,
	PiOpenedSession,
	PiSessionMessage,
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
	const messages = toPiSessionMessages(session.messages);
	return {
		transcript: {
			session: {
				id: session.sessionId,
				path,
				workspacePath,
				name: session.sessionName,
				firstMessage: baseInfo?.firstMessage ?? findFirstUserMessage(messages),
				messageCount: Math.max(
					baseInfo?.messageCount ?? 0,
					session.sessionManager.getEntries().length,
				),
				modifiedAt: baseInfo?.modified.toISOString() ?? new Date().toISOString(),
			},
			messages,
		},
		runtime: toPiSessionRuntimeState(session, services, path),
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

export function toPiSessionMessages(
	messages: AgentMessage[],
): PiSessionMessage[] {
	const result: PiSessionMessage[] = [];
	for (const message of messages) {
		if (message.role === "custom") {
			if (message.display) result.push(omitProperty(message, "details"));
			continue;
		}
		if (message.role === "toolResult") result.push(omitProperty(message, "details"));
		else if (message.role === "assistant") result.push(omitProperty(message, "diagnostics"));
		else result.push(message);
	}
	return result;
}

function toPiSessionRuntimeState(
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
		id: model.id,
		name: model.name,
		provider: model.provider,
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

function findFirstUserMessage(messages: PiSessionMessage[]): string {
	for (const message of messages) {
		if (message.role === "user") return messageContentToText(message.content);
	}
	return "";
}

function messageContentToText(content: UserMessage["content"]): string {
	if (typeof content === "string") return content;
	return content
		.map((block) => block.type === "text" ? block.text : "[图片]")
		.filter(Boolean)
		.join("\n");
}
