import type {
	PiConversationEntry,
	PiOpenedSession,
	PiSessionRuntimeState,
	PiSessionSummary,
	PiSessionTranscript,
} from "@shared/pi-contract";
import {
	classifyPiError,
	type PiConversationEntry as PiSdkConversationEntry,
	type PiSessionInfo,
	type PiSessionRuntimeSnapshot,
	type PiSessionSnapshot,
} from "@main/pi";

export function toSessionSummary(info: PiSessionInfo): PiSessionSummary {
	return {
		id: info.id,
		path: info.path,
		workspacePath: info.workspacePath,
		name: info.name,
		firstMessage: info.firstMessage,
		messageCount: info.messageCount,
		modifiedAt: info.modifiedAt,
	};
}

export function toSessionTranscript(
	info: PiSessionInfo,
	entries: PiSdkConversationEntry[],
): PiSessionTranscript {
	return {
		session: toSessionSummary(info),
		entries: entries.map(toConversationEntry),
	};
}

export function toOpenedSession(snapshot: PiSessionSnapshot): PiOpenedSession {
	return {
		runtime: toSessionRuntimeState(snapshot.runtime),
		transcript: toSessionTranscript(snapshot.info, snapshot.entries),
	};
}

export function toSessionRuntimeState(snapshot: PiSessionRuntimeSnapshot): PiSessionRuntimeState {
	return {
		sessionId: snapshot.sessionId,
		sessionPath: snapshot.sessionPath,
		isStreaming: snapshot.isStreaming,
		sessionName: snapshot.sessionName,
		model: snapshot.model,
		models: snapshot.models,
		thinkingLevel: snapshot.thinkingLevel,
		availableThinkingLevels: snapshot.availableThinkingLevels,
	};
}

function toConversationEntry(entry: PiSdkConversationEntry): PiConversationEntry {
	return {
		id: entry.id,
		parentId: entry.parentId,
		timestamp: entry.timestamp,
		role: entry.role,
		text: entry.text || formatAssistantFailure(entry.errorMessage),
		...(entry.thinking ? { thinking: entry.thinking } : {}),
	};
}

function formatAssistantFailure(errorMessage: string | undefined): string {
	if (!errorMessage) return "";
	if (classifyPiError(new Error(errorMessage)) === "authentication-resolution-failed") {
		if (/github-copilot/i.test(errorMessage)) {
			return `GitHub Copilot 登录已失效。请使用 Pi 的登录流程重新授权后重试。\n\n原始错误：${errorMessage}`;
		}
		return `模型登录已失效。请重新授权后重试。\n\n原始错误：${errorMessage}`;
	}
	return `模型请求失败：${errorMessage}`;
}
