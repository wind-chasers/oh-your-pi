import type {
	AgentSettledEvent,
	AgentStartEvent,
	SessionInfo,
	SourceInfo,
	ToolExecutionEndEvent,
	ToolExecutionStartEvent,
} from "@earendil-works/pi-coding-agent";
import type {
	BashExecutionMessage,
	BranchSummaryMessage,
	CompactionSummaryMessage,
	CustomMessage,
	ThinkingLevel,
} from "@earendil-works/pi-agent-core";
import type {
	AssistantMessage,
	AssistantMessageEvent,
	AuthPrompt,
	AuthType,
	Model,
	ToolResultMessage,
	UserMessage,
} from "@earendil-works/pi-ai";

export type { ThinkingLevel } from "@earendil-works/pi-agent-core";
export type { AuthType } from "@earendil-works/pi-ai";

type RoutedEvent<Event> = Event & { sessionPath: string };
type TextDelta = Extract<AssistantMessageEvent, { type: "text_delta" }>;
type ThinkingDelta = Extract<AssistantMessageEvent, { type: "thinking_delta" }>;
type AuthSelectPrompt = Extract<AuthPrompt, { type: "select" }>;

export type PiSessionMessage =
	| UserMessage
	| Omit<AssistantMessage, "diagnostics">
	| Omit<ToolResultMessage, "details">
	| BashExecutionMessage
	| Omit<CustomMessage, "details">
	| BranchSummaryMessage
	| CompactionSummaryMessage;

export type PiWorkspaceRequest = {
	workspacePath: string;
};

export type PiWorkspaceFileRequest = PiWorkspaceRequest & {
	relativePath?: string;
};

export type PiWorkspaceFile = {
	name: string;
	path: string;
	type: "directory" | "file";
};

export type PiWorkspaceFileContent = {
	content: string;
	isBinary: boolean;
	isTruncated: boolean;
	path: string;
};

export type PiWorkspacePickerResult = {
	workspacePath: string | null;
};

export type PiSessionTranscriptRequest = {
	workspacePath: string;
	sessionPath: string;
};

export type PiSessionCommand = {
	sessionPath: string;
	text: string;
};

export type PiSessionAbortRequest = {
	sessionPath: string;
};

export type PiSessionModelRequest = {
	sessionPath: string;
	provider: string;
	modelId: string;
};

export type PiSessionThinkingRequest = {
	sessionPath: string;
	thinkingLevel: ThinkingLevel;
};

export type PiSessionSummary = Pick<
	SessionInfo,
	"id" | "path" | "name" | "firstMessage" | "messageCount"
> & {
	workspacePath: string;
	modifiedAt: string;
};

export type PiResourceDiagnostic = {
	type: "info" | "warning" | "error";
	message: string;
};

export type PiResourceItem = Pick<SourceInfo, "path" | "source" | "scope"> & {
	name: string;
};

export type PiExtensionResource = PiResourceItem & {
	commands: string[];
	tools: string[];
};

export type PiAuthenticationStatus = {
	provider: string;
	name: string;
	status: "available" | "unavailable" | "unknown";
	type: AuthType | null;
	loginMethods: AuthType[];
};

export type PiAuthenticationLoginRequest = {
	provider: string;
	authType: AuthType;
};

export type PiAuthenticationCancelRequest = {
	provider: string;
};

export type PiAuthenticationPromptOption = Pick<
	AuthSelectPrompt["options"][number],
	"id" | "label"
>;

export type PiAuthenticationEvent = {
	provider: string;
	type: "auth_url" | "device_code" | "info" | "progress" | "prompt";
	message: string | null;
	url: string | null;
	userCode: string | null;
	promptId: string | null;
	placeholder: string | null;
	inputType: "text" | "secret" | "manual_code" | "select" | null;
	options: PiAuthenticationPromptOption[];
};

export type PiAuthenticationPromptResponse = {
	id: string;
	value: string;
};

export type PiResourceSummary = {
	extensions: number;
	skills: number;
	prompts: number;
	contextFiles: number;
	extensionDetails: PiExtensionResource[];
	skillDetails: PiResourceItem[];
	promptDetails: PiResourceItem[];
	diagnostics: PiResourceDiagnostic[];
};

export type PiWorkspaceSnapshot = {
	workspacePath: string;
	agentDir: string;
	resources: PiResourceSummary;
	authentication: PiAuthenticationStatus[];
	sessions: PiSessionSummary[];
};

export type PiToolPermissionRequest = {
	id: string;
	sessionPath: string;
	toolCallId: string | null;
	toolName: string;
	title: string;
	message: string;
	isDangerous: boolean;
};

export type PiToolPermissionResponse = {
	id: string;
	allowed: boolean;
};

export type PiToolPermissionResolution = {
	resolved: boolean;
};

export type PiSessionTranscript = {
	session: PiSessionSummary;
	messages: PiSessionMessage[];
};

export type PiModel = Pick<Model<any>, "provider" | "id" | "name" | "reasoning">;

export type PiSessionRuntimeState = {
	sessionId: string;
	sessionPath: string;
	isStreaming: boolean;
	sessionName: string | undefined;
	model: PiModel | undefined;
	models: PiModel[];
	thinkingLevel: ThinkingLevel;
	availableThinkingLevels: ThinkingLevel[];
};

export type PiOpenedSession = {
	runtime: PiSessionRuntimeState;
	transcript: PiSessionTranscript;
};

export type PiWorkspaceRefreshResult = {
	snapshot: PiWorkspaceSnapshot;
	openedSession?: PiOpenedSession;
};

export type PiSessionEvent =
	| RoutedEvent<Pick<AgentStartEvent, "type">>
	| RoutedEvent<Pick<AgentSettledEvent, "type">>
	| RoutedEvent<Pick<ToolExecutionStartEvent, "type" | "toolCallId" | "toolName">>
	| RoutedEvent<Pick<ToolExecutionEndEvent, "type" | "toolCallId" | "toolName" | "isError">>
	| RoutedEvent<Pick<TextDelta, "type" | "delta">>
	| RoutedEvent<Pick<ThinkingDelta, "type" | "delta">>
	| { sessionPath: string; type: "error"; errorMessage: NonNullable<AssistantMessage["errorMessage"]> };
