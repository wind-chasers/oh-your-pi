import type {
	PiAssistantContent,
	PiConversationEntry,
	PiMessageContent,
} from "@shared/pi-contract";
import type { ChatSession } from "./session";
import { haveSameDependencies } from "./utils";

type UserEntry = Extract<PiConversationEntry, { role: "user" }>;
type AssistantEntry = Extract<PiConversationEntry, { role: "assistant" }>;
type SystemEntry = Extract<PiConversationEntry, { role: "system" }>;
type BashEntry = Extract<PiConversationEntry, { role: "bashExecution" }>;
type CustomEntry = Extract<PiConversationEntry, { role: "custom" }>;
type ToolResultEntry = Extract<PiConversationEntry, { role: "toolResult" }>;

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
	| { type: "user"; entry: UserEntry; messageIndex: number; text: string }
	| { type: "assistant"; entry: AssistantEntry; messageIndex: number; text: string; thinking: string }
	| { type: "system"; entry: SystemEntry; messageIndex: number }
	| { type: "bash"; entry: BashEntry; messageIndex: number }
	| { type: "custom"; entry: CustomEntry; messageIndex: number; text: string }
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
	entry: ToolResultEntry;
	messageIndex: number;
	text: string;
};

type AssistantParts = {
	text: string;
	thinking: string;
	toolCalls: Extract<PiAssistantContent, { type: "toolCall" }>[];
};

type PendingToolSection = {
	firstOwnerId: string;
	firstMessageIndex: number;
	lastOwnerId: string;
	lastMessageIndex: number;
	toolCalls: SessionViewToolCall[];
};

const EMPTY_ITEMS: readonly SessionViewItem[] = [];

export class SessionView {
	private transcriptEntries: PiConversationEntry[] | null = null;
	private renderItems: readonly SessionViewItem[] = EMPTY_ITEMS;
	private calculationCache = new WeakMap<object, CachedCalculation>();

	public constructor(private readonly session: ChatSession) {}

	public get items(): readonly SessionViewItem[] {
		const entries = this.session.getSnapshot().openedSession?.transcript.entries;
		if (!entries) return EMPTY_ITEMS;
		if (entries !== this.transcriptEntries) {
			this.transcriptEntries = entries;
			this.renderItems = createSessionViewItems(entries);
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
		this.transcriptEntries = null;
		this.renderItems = EMPTY_ITEMS;
		this.calculationCache = new WeakMap();
	}
}

export function getSessionViewItemKey(item: SessionViewItem): string {
	if (item.type === "tool-section") return item.sectionKey;
	return `${item.type}:${item.entry.id}`;
}

function createSessionViewItems(entries: PiConversationEntry[]): SessionViewItem[] {
	const toolResults = collectToolResults(entries);
	const items: SessionViewItem[] = [];
	let pending: PendingToolSection | null = null;

	function flushPending(): void {
		if (!pending) return;
		items.push({
			type: "tool-section",
			sectionKey: `tool-section-${pending.firstOwnerId}__${pending.lastOwnerId}`,
			firstMessageIndex: pending.firstMessageIndex,
			lastMessageIndex: pending.lastMessageIndex,
			toolCalls: pending.toolCalls,
		});
		pending = null;
	}

	for (let messageIndex = 0; messageIndex < entries.length; messageIndex += 1) {
		const entry = entries[messageIndex];
		if (entry.role === "toolResult") continue;
		if (entry.role === "assistant") {
			const parts = readAssistantParts(entry);
			const hasVisibleMessage = Boolean(parts.text || parts.thinking);
			if (hasVisibleMessage) {
				flushPending();
				items.push({
					type: "assistant",
					entry,
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
					isError: result?.entry.isError ?? null,
					ownerMessageIndex: messageIndex,
					resultMessageIndex: result?.messageIndex ?? null,
					executionStatus: null,
				} satisfies SessionViewToolCall;
			});
			if (!pending) {
				pending = {
					firstOwnerId: entry.id,
					firstMessageIndex: messageIndex,
					lastOwnerId: entry.id,
					lastMessageIndex: messageIndex,
					toolCalls,
				};
			} else {
				pending.lastOwnerId = entry.id;
				pending.lastMessageIndex = messageIndex;
				pending.toolCalls.push(...toolCalls);
			}
			continue;
		}
		flushPending();
		if (entry.role === "user") {
			items.push({ type: "user", entry, messageIndex, text: messageContentToText(entry.content) });
		} else if (entry.role === "system") {
			items.push({ type: "system", entry, messageIndex });
		} else if (entry.role === "bashExecution") {
			items.push({ type: "bash", entry, messageIndex });
		} else {
			items.push({ type: "custom", entry, messageIndex, text: messageContentToText(entry.content) });
		}
	}
	flushPending();
	return items;
}

function collectToolResults(entries: PiConversationEntry[]): Map<string, ToolResult> {
	const results = new Map<string, ToolResult>();
	for (let messageIndex = 0; messageIndex < entries.length; messageIndex += 1) {
		const entry = entries[messageIndex];
		if (entry.role !== "toolResult") continue;
		results.set(entry.toolCallId, {
			entry,
			messageIndex,
			text: messageContentToText(entry.content),
		});
	}
	return results;
}

function readAssistantParts(entry: AssistantEntry): AssistantParts {
	const text: string[] = [];
	const thinking: string[] = [];
	const toolCalls: AssistantParts["toolCalls"] = [];
	for (const block of entry.content) {
		if (block.type === "text") text.push(block.text);
		else if (block.type === "thinking") thinking.push(block.thinking);
		else if (block.type === "toolCall") toolCalls.push(block);
		else text.push("[图片]");
	}
	const visibleText = text.filter(Boolean).join("\n");
	return {
		text: visibleText || formatAssistantFailure(entry.errorMessage),
		thinking: thinking.filter(Boolean).join("\n"),
		toolCalls,
	};
}

function messageContentToText(content: PiMessageContent[]): string {
	return content
		.map((block) => block.type === "text" ? block.text : "[图片]")
		.filter(Boolean)
		.join("\n");
}

function formatAssistantFailure(errorMessage: string | null): string {
	if (!errorMessage) return "";
	if (/github-copilot/i.test(errorMessage)) {
		return `GitHub Copilot 登录已失效。请使用 Pi 的登录流程重新授权后重试。\n\n原始错误：${errorMessage}`;
	}
	return `模型请求失败：${errorMessage}`;
}
