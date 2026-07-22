import type { SessionEntry, SessionInfo } from "@earendil-works/pi-coding-agent";
import type { PiConversationEntry, PiModel, PiSessionSummary } from "@shared/pi-contract";

type ContentBlock = {
	type: string;
	text?: string;
	thinking?: string;
	name?: string;
};

export function toSessionSummary(session: SessionInfo): PiSessionSummary {
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

export function toPiModel(model: { id: string; name: string; provider: string; reasoning: boolean }): PiModel {
	return {
		id: model.id,
		name: model.name,
		provider: model.provider,
		reasoning: model.reasoning,
	};
}

export function toConversationEntry(entry: SessionEntry): PiConversationEntry[] {
	if (entry.type === "compaction" || entry.type === "branch_summary") {
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "system", text: entry.summary }];
	}
	if (entry.type === "custom_message") {
		if (!entry.display) return [];
		return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "custom", text: contentToText(entry.content) }];
	}
	if (entry.type !== "message") return [];

	const message = entry.message;
	if (message.role === "user") return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "user", text: contentToText(message.content) }];
	if (message.role === "assistant") {
		const { text, thinking } = contentToAssistantContent(message.content);
		const error = message.stopReason === "error" ? formatAssistantFailure(message.errorMessage) : "";
		return [{
			id: entry.id,
			parentId: entry.parentId,
			timestamp: entry.timestamp,
			role: "assistant",
			text: text || error,
			...(thinking ? { thinking } : {}),
		}];
	}
	if (message.role === "toolResult") return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "tool", text: contentToText(message.content) }];
	if (message.role === "bashExecution") return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "bash", text: message.output }];
	if (message.role === "custom" && message.display) return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "custom", text: contentToText(message.content) }];
	if (message.role === "branchSummary" || message.role === "compactionSummary") return [{ id: entry.id, parentId: entry.parentId, timestamp: entry.timestamp, role: "system", text: message.summary }];
	return [];
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

function formatAssistantFailure(errorMessage: string | undefined): string {
	if (!errorMessage) return "模型请求失败。";
	if (/OAuth (auth derivation|refresh) failed for github-copilot/i.test(errorMessage)) {
		return `GitHub Copilot 登录已失效。请使用 Pi 的登录流程重新授权后重试。\n\n原始错误：${errorMessage}`;
	}
	return `模型请求失败：${errorMessage}`;
}

