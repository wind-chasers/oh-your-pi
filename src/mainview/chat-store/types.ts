import type {
	PiImageAttachment,
	PiOpenedSession,
	PiToolPermissionRequest,
} from "@shared/pi-contract";

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

export type ChatUserInput = {
	text: string;
	attachments: readonly PiImageAttachment[];
};

export type ChatMessageImagePreview = {
	id: string;
	alt: string;
	src: string;
};

export type ChatPendingUserMessage = {
	clientId: string;
	text: string;
	images: readonly ChatMessageImagePreview[];
};

export type ChatQueuedUserInput = {
	state: "submitting" | "queued";
	message: ChatPendingUserMessage;
};

export type ChatQueuedInputs = {
	steering: readonly ChatQueuedUserInput[];
	followUps: readonly ChatQueuedUserInput[];
};

export type ChatLiveAgentTail = {
	phase: "streaming" | "settled-awaiting-commit";
	text: string;
	thinking: string;
	tools: readonly ChatToolCall[];
	permissionRequests: readonly PiToolPermissionRequest[];
};

export type ChatTranscriptTail =
	| { type: "empty" }
	| { type: "optimistic-user"; message: ChatPendingUserMessage }
	| { type: "live-agent"; output: ChatLiveAgentTail };

export type ChatSessionTransientState = {
	tail: ChatTranscriptTail;
	queuedInputs: ChatQueuedInputs;
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
	transient: ChatSessionTransientState;
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
