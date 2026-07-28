import type {
	BashExecutionMessage,
	BranchSummaryMessage,
	CompactionSummaryMessage,
	CustomMessage,
} from "@earendil-works/pi-agent-core";
import type {
	AssistantMessage,
	ImageContent,
	ToolCall,
	ToolResultMessage,
	UserMessage,
} from "@earendil-works/pi-ai";
import type { PiSessionMessage } from "@shared/pi-contract";
import type { ChatSession } from "./session";
import { haveSameDependencies } from "./utils";

export type SessionViewToolCall = {
	id: string;
	name: string;
	input: Record<string, unknown>;
	output: string | null;
	isError: boolean | null;
	ownerMessageIndex: number;
	resultMessageIndex: number | null;
	executionStatus: null;
};

export type SessionViewItem =
	| { type: "user"; message: UserMessage; messageIndex: number; text: string; images: ImageContent[] }
	| { type: "assistant"; message: AssistantMessage; messageIndex: number; text: string; thinking: string }
	| { type: "system"; message: BranchSummaryMessage | CompactionSummaryMessage; messageIndex: number; text: string }
	| { type: "bash"; message: BashExecutionMessage; messageIndex: number }
	| { type: "custom"; message: CustomMessage; messageIndex: number; text: string }
	| {
		type: "tool-section";
		sectionKey: string;
		firstMessageIndex: number;
		lastMessageIndex: number;
		toolCalls: SessionViewToolCall[];
	};

type CachedCalculation = {
	dependencies: readonly unknown[];
	value: unknown;
};

type ToolResult = {
	message: ToolResultMessage;
	messageIndex: number;
	text: string;
};

type AssistantParts = {
	text: string;
	thinking: string;
	toolCalls: ToolCall[];
};

type PendingToolSection = {
	firstMessageIndex: number;
	lastMessageIndex: number;
	toolCalls: SessionViewToolCall[];
};

const EMPTY_ITEMS: readonly SessionViewItem[] = [];

export class SessionView {
	private transcriptMessages: PiSessionMessage[] | null = null;
	private renderItems: readonly SessionViewItem[] = EMPTY_ITEMS;
	private calculationCache = new WeakMap<object, CachedCalculation>();

	public constructor(private readonly session: ChatSession) {}

	public get items(): readonly SessionViewItem[] {
		const messages = this.session.getSnapshot().openedSession?.transcript.messages;
		if (!messages) return EMPTY_ITEMS;
		if (messages !== this.transcriptMessages) {
			this.transcriptMessages = messages;
			this.renderItems = createSessionViewItems(messages);
		}
		return this.renderItems;
	}

	public cache<T>(
		key: object,
		dependencies: readonly unknown[],
		calculate: () => T,
	): T {
		const cached = this.calculationCache.get(key);
		if (cached && haveSameDependencies(cached.dependencies, dependencies)) {
			return cached.value as T;
		}
		const value = calculate();
		this.calculationCache.set(key, { dependencies: [...dependencies], value });
		return value;
	}

	public dispose(): void {
		this.transcriptMessages = null;
		this.renderItems = EMPTY_ITEMS;
		this.calculationCache = new WeakMap();
	}
}

export function getSessionViewItemKey(item: SessionViewItem): string {
	if (item.type === "tool-section") return item.sectionKey;
	return `${item.type}:${item.messageIndex}:${item.message.timestamp}`;
}

function createSessionViewItems(messages: PiSessionMessage[]): SessionViewItem[] {
	const toolResults = collectToolResults(messages);
	const items: SessionViewItem[] = [];
	let pending: PendingToolSection | null = null;

	function flushPending(): void {
		if (!pending) return;
		items.push({
			type: "tool-section",
			sectionKey: [
				"tool-section",
				pending.firstMessageIndex,
				pending.lastMessageIndex,
				...pending.toolCalls.map((toolCall) => toolCall.id),
			].join("-"),
			firstMessageIndex: pending.firstMessageIndex,
			lastMessageIndex: pending.lastMessageIndex,
			toolCalls: pending.toolCalls,
		});
		pending = null;
	}

	for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
		const message = messages[messageIndex];
		if (message.role === "toolResult") continue;
		if (message.role === "assistant") {
			const parts = readAssistantParts(message);
			const hasVisibleMessage = Boolean(parts.text || parts.thinking);
			if (hasVisibleMessage) {
				flushPending();
				items.push({
					type: "assistant",
					message,
					messageIndex,
					text: parts.text,
					thinking: parts.thinking,
				});
			}
			if (parts.toolCalls.length === 0) {
				if (!hasVisibleMessage) flushPending();
				continue;
			}
			const toolCalls = parts.toolCalls.map((toolCall) => {
				const result = toolResults.get(toolCall.id);
				return {
					id: toolCall.id,
					name: toolCall.name,
					input: toolCall.arguments,
					output: result?.text ?? null,
					isError: result?.message.isError ?? null,
					ownerMessageIndex: messageIndex,
					resultMessageIndex: result?.messageIndex ?? null,
					executionStatus: null,
				} satisfies SessionViewToolCall;
			});
			if (!pending) {
				pending = {
					firstMessageIndex: messageIndex,
					lastMessageIndex: messageIndex,
					toolCalls,
				};
			} else {
				pending.lastMessageIndex = messageIndex;
				pending.toolCalls.push(...toolCalls);
			}
			continue;
		}
		flushPending();
		if (message.role === "user") {
			const parts = readUserParts(message);
			items.push({ type: "user", message, messageIndex, ...parts });
		} else if (message.role === "branchSummary" || message.role === "compactionSummary") {
			items.push({ type: "system", message, messageIndex, text: message.summary });
		} else if (message.role === "bashExecution") {
			items.push({ type: "bash", message, messageIndex });
		} else if (message.display) {
			items.push({ type: "custom", message, messageIndex, text: messageContentToText(message.content) });
		}
	}
	flushPending();
	return items;
}

function collectToolResults(messages: PiSessionMessage[]): Map<string, ToolResult> {
	const results = new Map<string, ToolResult>();
	for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
		const message = messages[messageIndex];
		if (message.role !== "toolResult") continue;
		results.set(message.toolCallId, {
			message,
			messageIndex,
			text: messageContentToText(message.content),
		});
	}
	return results;
}

function readUserParts(message: UserMessage): { text: string; images: ImageContent[] } {
	if (typeof message.content === "string") return { text: message.content, images: [] };
	const text: string[] = [];
	const images: ImageContent[] = [];
	for (const block of message.content) {
		if (block.type === "text") text.push(block.text);
		else images.push(block);
	}
	return { text: text.filter(Boolean).join("\n"), images };
}

function readAssistantParts(message: AssistantMessage): AssistantParts {
	const text: string[] = [];
	const thinking: string[] = [];
	const toolCalls: ToolCall[] = [];
	for (const block of message.content) {
		if (block.type === "text") text.push(block.text);
		else if (block.type === "thinking") thinking.push(block.thinking);
		else toolCalls.push(block);
	}
	const visibleText = text.filter(Boolean).join("\n");
	return {
		text: visibleText || formatAssistantFailure(
			message.stopReason === "error" ? message.errorMessage : undefined,
		),
		thinking: thinking.filter(Boolean).join("\n"),
		toolCalls,
	};
}

function messageContentToText(
	content: UserMessage["content"] | CustomMessage["content"] | ToolResultMessage["content"],
): string {
	if (typeof content === "string") return content;
	return content
		.map((block) => block.type === "text" ? block.text : "[图片]")
		.filter(Boolean)
		.join("\n");
}

function formatAssistantFailure(errorMessage: string | undefined): string {
	if (!errorMessage) return "";
	if (/OAuth (auth derivation|refresh) failed/i.test(errorMessage)) {
		if (/github-copilot/i.test(errorMessage)) {
			return `GitHub Copilot 登录已失效。请使用 Pi 的登录流程重新授权后重试。\n\n原始错误：${errorMessage}`;
		}
		return `模型登录已失效。请重新授权后重试。\n\n原始错误：${errorMessage}`;
	}
	return `模型请求失败：${errorMessage}`;
}
