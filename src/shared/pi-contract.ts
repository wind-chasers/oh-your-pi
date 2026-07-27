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

export type PiThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type PiSessionModelRequest = {
	sessionPath: string;
	provider: string;
	modelId: string;
};

export type PiSessionThinkingRequest = {
	sessionPath: string;
	thinkingLevel: PiThinkingLevel;
};

export type PiSessionSummary = {
	id: string;
	path: string;
	workspacePath: string;
	name: string | null;
	firstMessage: string;
	messageCount: number;
	modifiedAt: string;
};

export type PiResourceDiagnostic = {
	type: "info" | "warning" | "error";
	message: string;
};

export type PiResourceItem = {
	name: string;
	path: string;
	scope: "user" | "project" | "temporary";
	source: string;
};

export type PiExtensionResource = PiResourceItem & {
	commands: string[];
	tools: string[];
};

export type PiAuthenticationMethod = "oauth" | "api_key";

export type PiAuthenticationStatus = {
	provider: string;
	name: string;
	status: "available" | "unavailable" | "unknown";
	type: PiAuthenticationMethod | null;
	loginMethods: PiAuthenticationMethod[];
};

export type PiAuthenticationLoginRequest = {
	provider: string;
	authType: PiAuthenticationMethod;
};

export type PiAuthenticationCancelRequest = {
	provider: string;
};

export type PiAuthenticationPromptOption = {
	id: string;
	label: string;
};

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

export type PiConversationEntry = {
	id: string;
	parentId: string | null;
	timestamp: string;
	role: "user" | "assistant" | "tool" | "bash" | "custom" | "system";
	text: string;
	thinking?: string;
};

export type PiSessionTranscript = {
	session: PiSessionSummary;
	entries: PiConversationEntry[];
};

export type PiModel = {
	provider: string;
	id: string;
	name: string;
	reasoning: boolean;
};

export type PiSessionRuntimeState = {
	sessionId: string;
	sessionPath: string;
	isStreaming: boolean;
	sessionName: string | null;
	model: PiModel | null;
	models: PiModel[];
	thinkingLevel: PiThinkingLevel;
	availableThinkingLevels: PiThinkingLevel[];
};

export type PiOpenedSession = {
	runtime: PiSessionRuntimeState;
	transcript: PiSessionTranscript;
};

export type PiWorkspaceRefreshResult = {
	snapshot: PiWorkspaceSnapshot;
	openedSession?: PiOpenedSession;
};

export type PiSessionEvent = {
	sessionPath: string;
	type: "agent_start" | "agent_end" | "agent_settled" | "assistant_text_delta" | "assistant_thinking_delta" | "tool_start" | "tool_update" | "tool_end" | "message_end" | "error";
	text: string | null;
	toolCallId: string | null;
	toolName: string | null;
	isError: boolean | null;
};

