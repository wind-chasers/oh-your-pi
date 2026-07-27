import type {
	AgentSession,
	AgentSessionServices,
	SessionEntry,
	SessionInfo,
} from "@earendil-works/pi-coding-agent";

export type PiThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type PiModelInfo = {
	id: string;
	name: string;
	provider: string;
	reasoning: boolean;
};

export type PiSessionInfo = {
	id: string;
	path: string;
	workspacePath: string;
	name: string | null;
	firstMessage: string;
	messageCount: number;
	modifiedAt: string;
};

export type PiConversationEntry = {
	id: string;
	parentId: string | null;
	timestamp: string;
	role: "user" | "assistant" | "tool" | "bash" | "custom" | "system";
	text: string;
	thinking?: string;
	errorMessage?: string;
};

export type PiSessionRuntimeSnapshot = {
	sessionId: string;
	sessionPath: string;
	isStreaming: boolean;
	sessionName: string | null;
	model: PiModelInfo | null;
	models: PiModelInfo[];
	thinkingLevel: PiThinkingLevel;
	availableThinkingLevels: PiThinkingLevel[];
};

export type PiSessionSnapshot = {
	info: PiSessionInfo;
	entries: PiConversationEntry[];
	runtime: PiSessionRuntimeSnapshot;
};

type ContentBlock = {
	type: string;
	text?: string;
	thinking?: string;
	name?: string;
};

export function createPiSessionSnapshot(options: {
	baseInfo?: SessionInfo;
	path: string;
	services: AgentSessionServices;
	session: AgentSession;
	workspacePath: string;
}): PiSessionSnapshot {
	const { baseInfo, path, services, session, workspacePath } = options;
	const entries = session.sessionManager.getBranch().flatMap(toPiConversationEntry);
	return {
		info: {
			id: session.sessionId,
			path,
			workspacePath,
			name: session.sessionName ?? null,
			firstMessage: baseInfo?.firstMessage ?? entries.find((entry) => entry.role === "user")?.text ?? "",
			messageCount: Math.max(baseInfo?.messageCount ?? 0, session.sessionManager.getEntries().length),
			modifiedAt: baseInfo?.modified.toISOString() ?? new Date().toISOString(),
		},
		entries,
		runtime: {
			sessionId: session.sessionId,
			sessionPath: path,
			isStreaming: session.isStreaming,
			sessionName: session.sessionName ?? null,
			model: session.model ? toPiModel(session.model) : null,
			models: services.modelRuntime.getModels().map(toPiModel),
			thinkingLevel: session.thinkingLevel,
			availableThinkingLevels: session.getAvailableThinkingLevels(),
		},
	};
}

export function toPiSessionInfo(session: SessionInfo): PiSessionInfo {
	return {
		id: session.id,
		path: session.path,
		workspacePath: session.cwd,
		name: session.name ?? null,
		firstMessage: session.firstMessage,
		messageCount: session.messageCount,
		modifiedAt: session.modified.toISOString(),
	};
}

export function toPiConversationEntry(entry: SessionEntry): PiConversationEntry[] {
	if (entry.type === "compaction" || entry.type === "branch_summary") {
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "system", text: entry.summary }];
	}
	if (entry.type === "custom_message") {
		if (!entry.display) return [];
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "custom", text: contentToText(entry.content) }];
	}
	if (entry.type !== "message") return [];

	const message = entry.message;
	if (message.role === "user") {
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "user", text: contentToText(message.content) }];
	}
	if (message.role === "assistant") {
		const { text, thinking } = contentToAssistantContent(message.content);
		return [{
			id: entry.id,
			parentId: entry.parentId,
			timestamp: entry.timestamp,
			role: "assistant",
			text,
			...(thinking ? { thinking } : {}),
			...(message.stopReason === "error" && message.errorMessage ? { errorMessage: message.errorMessage } : {}),
		}];
	}
	if (message.role === "toolResult") {
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "tool", text: contentToText(message.content) }];
	}
	if (message.role === "bashExecution") {
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "bash", text: message.output }];
	}
	if (message.role === "custom" && message.display) {
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "custom", text: contentToText(message.content) }];
	}
	if (message.role === "branchSummary" || message.role === "compactionSummary") {
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "system", text: message.summary }];
	}
	return [];
}

function toPiModel(model: { id: string; name: string; provider: string; reasoning: boolean }): PiModelInfo {
	return {
		id: model.id,
		name: model.name,
		provider: model.provider,
		reasoning: model.reasoning,
	};
}

function contentToAssistantContent(content: string | readonly ContentBlock[]): { text: string; thinking: string } {
	if (typeof content === "string") return { text: content, thinking: "" };
	const text: string[] = [];
	const thinking: string[] = [];
	for (const block of content) {
		if (block.type === "thinking") thinking.push(block.thinking ?? "");
		else if (block.type === "text") text.push(block.text ?? "");
		else if (block.type === "toolCall") text.push(`调用工具：${block.name ?? "unknown"}`);
		else if (block.type === "image") text.push("[图片]");
	}
	return {
		text: text.filter(Boolean).join("\n"),
		thinking: thinking.filter(Boolean).join("\n"),
	};
}

function contentToText(content: string | readonly ContentBlock[]): string {
	if (typeof content === "string") return content;
	return content
		.map((block) => {
			if (block.type === "text") return block.text ?? "";
			if (block.type === "thinking") return block.thinking ?? "";
			if (block.type === "toolCall") return `调用工具：${block.name ?? "unknown"}`;
			if (block.type === "image") return "[图片]";
			return "";
		})
		.filter(Boolean)
		.join("\n");
}
