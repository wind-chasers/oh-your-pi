import type { PiOpenedSession, PiToolPermissionRequest } from "@shared/pi-contract";

export const DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS = 10 * 60_000;
export const DEFAULT_SESSION_SWEEP_INTERVAL_MS = 60_000;

export type ChatSessionPhase = "idle" | "loading" | "ready" | "failed";
export type ChatToolExecutionStatus = "awaiting_permission" | "running" | "completed";

export type ChatToolCall = {
	id: string;
	name: string;
	input: Record<string, unknown>;
	output: string | null;
	isError: boolean | null;
	executionStatus: ChatToolExecutionStatus;
};

export type ChatSessionSnapshot = {
	workspacePath: string;
	sessionId: string;
	sessionPath: string;
	phase: ChatSessionPhase;
	openedSession: PiOpenedSession | null;
	isRefreshing: boolean;
	isSending: boolean;
	error: string | null;
	pendingUserMessage: string | null;
	streamedText: string;
	thinkingText: string;
	tools: readonly ChatToolCall[];
	permissionRequests: readonly PiToolPermissionRequest[];
};

export type ChatSessionActivity = {
	lastActiveAt: number;
	consumerCount: number;
	isBusy: boolean;
	isStreaming: boolean;
};

export type ChatStoreOptions = {
	inactivityTimeoutMs?: number;
	sweepIntervalMs?: number;
	now?: () => number;
};
