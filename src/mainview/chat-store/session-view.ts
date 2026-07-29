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
import type { PiSessionTranscriptEntry } from "@shared/pi-contract";
import type { SessionSnapshot } from "./snapshot";
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

export type UserViewItem =
	| { type: "user"; entryId: string; message: UserMessage; messageIndex: number; text: string; images: ImageContent[] };
export type SessionViewItem =
	| UserViewItem
	| { type: "assistant"; entryId: string; message: AssistantMessage; messageIndex: number; text: string; thinking: string }
	| { type: "system"; entryId: string; message: BranchSummaryMessage | CompactionSummaryMessage; messageIndex: number; text: string }
	| { type: "bash"; entryId: string; message: BashExecutionMessage; messageIndex: number }
	| { type: "custom"; entryId: string; message: CustomMessage; messageIndex: number; text: string }
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
	entryIds: string[];
};

const EMPTY_ITEMS: readonly SessionViewItem[] = [];

export class SessionView {
	private transcriptEntries: readonly PiSessionTranscriptEntry[] | null = null;
	private renderItems: readonly SessionViewItem[] = EMPTY_ITEMS;
	private calculationCache = new WeakMap<object, CachedCalculation>();

	public constructor(private readonly snapshot: SessionSnapshot) {}

	public get items(): readonly SessionViewItem[] {
		const entries = this.snapshot.get().openedSession?.transcript.entries;
		if (!entries) return EMPTY_ITEMS;
		if (entries === this.transcriptEntries) return this.renderItems;
		if (this.transcriptEntries) {
			const unchangedPrefix = commonEntryPrefixLength(this.transcriptEntries, entries);
			const appendOnly = unchangedPrefix === this.transcriptEntries.length
				&& entries.length > unchangedPrefix;
			const rebuildFrom = appendOnly
				? findCurrentTurnStart(entries)
				: findRebaseStart(this.transcriptEntries, entries, unchangedPrefix, this.renderItems);
			if (rebuildFrom > 0) {
				const prefix = this.renderItems.filter((item) => getLastMessageIndex(item) < rebuildFrom);
				this.renderItems = [...prefix, ...createSessionViewItems(entries, rebuildFrom)];
			} else {
				this.renderItems = createSessionViewItems(entries);
			}
		} else {
			this.renderItems = createSessionViewItems(entries);
		}
		this.transcriptEntries = entries;
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
	return item.type === "tool-section" ? item.sectionKey : item.entryId;
}

function createSessionViewItems(
	entries: readonly PiSessionTranscriptEntry[],
	startIndex = 0,
): SessionViewItem[] {
	const toolResults = collectToolResults(entries, startIndex);
	const items: SessionViewItem[] = [];
	let pending: PendingToolSection | null = null;

	function flushPending(): void {
		if (!pending) return;
		items.push({
			type: "tool-section",
			sectionKey: `tool-section:${pending.entryIds.join(":")}`,
			firstMessageIndex: pending.firstMessageIndex,
			lastMessageIndex: pending.lastMessageIndex,
			toolCalls: pending.toolCalls,
		});
		pending = null;
	}

	for (let messageIndex = startIndex; messageIndex < entries.length; messageIndex += 1) {
		const entry = entries[messageIndex];
		const message = entry.message;
		if (message.role === "toolResult") continue;
		if (message.role === "assistant") {
			const parts = readAssistantParts(message);
			const hasVisibleMessage = Boolean(parts.text || parts.thinking);
			if (hasVisibleMessage) {
				flushPending();
				items.push({
					type: "assistant",
					entryId: entry.id,
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
					entryIds: [entry.id],
				};
			} else {
				pending.lastMessageIndex = messageIndex;
				pending.toolCalls.push(...toolCalls);
				pending.entryIds.push(entry.id);
			}
			continue;
		}
		flushPending();
		if (message.role === "user") {
			const parts = readUserParts(message);
			items.push({ type: "user", entryId: entry.id, message, messageIndex, ...parts });
		} else if (message.role === "branchSummary" || message.role === "compactionSummary") {
			items.push({ type: "system", entryId: entry.id, message, messageIndex, text: message.summary });
		} else if (message.role === "bashExecution") {
			items.push({ type: "bash", entryId: entry.id, message, messageIndex });
		} else if (message.display) {
			items.push({ type: "custom", entryId: entry.id, message, messageIndex, text: messageContentToText(message.content) });
		}
	}
	flushPending();
	return items;
}

function collectToolResults(
	entries: readonly PiSessionTranscriptEntry[],
	startIndex: number,
): Map<string, ToolResult> {
	const results = new Map<string, ToolResult>();
	for (let messageIndex = startIndex; messageIndex < entries.length; messageIndex += 1) {
		const message = entries[messageIndex].message;
		if (message.role !== "toolResult") continue;
		results.set(message.toolCallId, {
			message,
			messageIndex,
			text: messageContentToText(message.content),
		});
	}
	return results;
}

function commonEntryPrefixLength(
	previous: readonly PiSessionTranscriptEntry[],
	next: readonly PiSessionTranscriptEntry[],
): number {
	const limit = Math.min(previous.length, next.length);
	let index = 0;
	while (index < limit && previous[index] === next[index]) index += 1;
	return index;
}

function findRebaseStart(
	previous: readonly PiSessionTranscriptEntry[],
	next: readonly PiSessionTranscriptEntry[],
	unchangedPrefix: number,
	items: readonly SessionViewItem[],
): number {
	if (unchangedPrefix === 0) return 0;
	let rebuildFrom = unchangedPrefix;
	const changedToolIds = [previous[unchangedPrefix], next[unchangedPrefix]]
		.flatMap((entry) => entry?.message.role === "toolResult" ? [entry.message.toolCallId] : []);
	const nextRole = next[unchangedPrefix]?.message.role;
	for (const item of items) {
		if (item.type !== "tool-section") continue;
		if (
			item.lastMessageIndex >= unchangedPrefix
			|| (item.lastMessageIndex === unchangedPrefix - 1 && nextRole === "assistant")
			|| item.toolCalls.some((toolCall) => changedToolIds.includes(toolCall.id))
		) {
			rebuildFrom = Math.min(rebuildFrom, item.firstMessageIndex);
		}
	}
	return rebuildFrom;
}

function findCurrentTurnStart(entries: readonly PiSessionTranscriptEntry[]): number {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		if (entries[index].message.role === "user") return index;
	}
	return 0;
}

function getLastMessageIndex(item: SessionViewItem): number {
	return item.type === "tool-section" ? item.lastMessageIndex : item.messageIndex;
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
