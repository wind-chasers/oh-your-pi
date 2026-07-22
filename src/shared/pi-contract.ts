import { z } from "zod";

export const PiWorkspaceRequestSchema = z.object({
	workspacePath: z.string().trim().min(1),
});

export const PiWorkspaceFileRequestSchema = PiWorkspaceRequestSchema.extend({
	relativePath: z.string().trim().min(1).optional(),
});

export const PiWorkspaceFileSchema = z.object({
	name: z.string(),
	path: z.string(),
	type: z.enum(["directory", "file"]),
});

export const PiWorkspaceFileContentSchema = z.object({
	content: z.string(),
	isBinary: z.boolean(),
	isTruncated: z.boolean(),
	path: z.string(),
});

export const PiWorkspacePickerResultSchema = z.object({
	workspacePath: z.string().nullable(),
});


export const PiSessionTranscriptRequestSchema = z.object({
	workspacePath: z.string().trim().min(1),
	sessionPath: z.string().trim().min(1),
});


export const PiSessionCommandSchema = z.object({
	sessionPath: z.string().trim().min(1),
	text: z.string().trim().min(1),
});

export const PiSessionAbortRequestSchema = z.object({
	sessionPath: z.string().trim().min(1),
});


export const PiThinkingLevelSchema = z.enum(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

export const PiSessionModelRequestSchema = z.object({
	sessionPath: z.string().trim().min(1),
	provider: z.string().trim().min(1),
	modelId: z.string().trim().min(1),
});

export const PiSessionThinkingRequestSchema = z.object({
	sessionPath: z.string().trim().min(1),
	thinkingLevel: PiThinkingLevelSchema,
});


export const PiSessionSummarySchema = z.object({
	id: z.string(),
	path: z.string(),
	workspacePath: z.string(),
	name: z.string().nullable(),
	firstMessage: z.string(),
	messageCount: z.number().int().nonnegative(),
	modifiedAt: z.string(),
});

export const PiResourceDiagnosticSchema = z.object({
	type: z.enum(["info", "warning", "error"]),
	message: z.string(),
});

export const PiResourceItemSchema = z.object({
	name: z.string(),
	path: z.string(),
	scope: z.enum(["user", "project", "temporary"]),
	source: z.string(),
});

export const PiExtensionResourceSchema = PiResourceItemSchema.extend({
	commands: z.array(z.string()),
	tools: z.array(z.string()),
});

export const PiAuthenticationMethodSchema = z.enum(["oauth", "api_key"]);

export const PiAuthenticationStatusSchema = z.object({
	provider: z.string(),
	name: z.string(),
	status: z.enum(["available", "unavailable", "unknown"]),
	type: PiAuthenticationMethodSchema.nullable(),
	loginMethods: z.array(PiAuthenticationMethodSchema),
});

export const PiAuthenticationLoginRequestSchema = z.object({
	provider: z.string().trim().min(1),
	authType: PiAuthenticationMethodSchema,
});

export const PiAuthenticationCancelRequestSchema = z.object({
	provider: z.string().trim().min(1),
});

export const PiAuthenticationPromptOptionSchema = z.object({
	id: z.string(),
	label: z.string(),
});

export const PiAuthenticationEventSchema = z.object({
	provider: z.string(),
	type: z.enum(["auth_url", "device_code", "info", "progress", "prompt"]),
	message: z.string().nullable(),
	url: z.string().url().nullable(),
	userCode: z.string().nullable(),
	promptId: z.string().uuid().nullable(),
	placeholder: z.string().nullable(),
	inputType: z.enum(["text", "secret", "manual_code", "select"]).nullable(),
	options: z.array(PiAuthenticationPromptOptionSchema),
});

export const PiAuthenticationPromptResponseSchema = z.object({
	id: z.string().uuid(),
	value: z.string(),
});

export const PiResourceSummarySchema = z.object({
	extensions: z.number().int().nonnegative(),
	skills: z.number().int().nonnegative(),
	prompts: z.number().int().nonnegative(),
	contextFiles: z.number().int().nonnegative(),
	extensionDetails: z.array(PiExtensionResourceSchema),
	skillDetails: z.array(PiResourceItemSchema),
	promptDetails: z.array(PiResourceItemSchema),
	diagnostics: z.array(PiResourceDiagnosticSchema),
});

export const PiWorkspaceSnapshotSchema = z.object({
	workspacePath: z.string(),
	agentDir: z.string(),
	resources: PiResourceSummarySchema,
	authentication: z.array(PiAuthenticationStatusSchema),
	sessions: z.array(PiSessionSummarySchema),
});

export const PiToolPermissionRequestSchema = z.object({
	id: z.string().uuid(),
	sessionPath: z.string(),
	toolCallId: z.string().nullable(),
	toolName: z.string(),
	title: z.string(),
	message: z.string(),
	isDangerous: z.boolean(),
});

export const PiToolPermissionResponseSchema = z.object({
	id: z.string().uuid(),
	allowed: z.boolean(),
});

export const PiToolPermissionResolutionSchema = z.object({
	resolved: z.boolean(),
});

export const PiConversationEntrySchema = z.object({
	id: z.string(),
	parentId: z.string().nullable(),
	timestamp: z.string(),
	role: z.enum(["user", "assistant", "tool", "bash", "custom", "system"]),
	text: z.string(),
	thinking: z.string().optional(),
});

export const PiSessionTranscriptSchema = z.object({
	session: PiSessionSummarySchema,
	entries: z.array(PiConversationEntrySchema),
});


export const PiModelSchema = z.object({
	provider: z.string(),
	id: z.string(),
	name: z.string(),
	reasoning: z.boolean(),
});

export const PiSessionRuntimeStateSchema = z.object({
	sessionId: z.string(),
	sessionPath: z.string(),
	isStreaming: z.boolean(),
	sessionName: z.string().nullable(),
	model: PiModelSchema.nullable(),
	models: z.array(PiModelSchema),
	thinkingLevel: PiThinkingLevelSchema,
	availableThinkingLevels: z.array(PiThinkingLevelSchema),
});

export const PiOpenedSessionSchema = z.object({
	runtime: PiSessionRuntimeStateSchema,
	transcript: PiSessionTranscriptSchema,
});
export const PiWorkspaceRefreshResultSchema = z.object({
	snapshot: PiWorkspaceSnapshotSchema,
	openedSession: PiOpenedSessionSchema.optional(),
});

export const PiSessionEventSchema = z.object({
	sessionPath: z.string(),
	type: z.enum([
		"agent_start",
		"agent_end",
		"agent_settled",
		"assistant_text_delta",
		"assistant_thinking_delta",
		"tool_start",
		"tool_update",
		"tool_end",
		"message_end",
		"error",
	]),
	text: z.string().nullable(),
	toolCallId: z.string().nullable(),
	toolName: z.string().nullable(),
	isError: z.boolean().nullable(),
});

export const PiRuntimeDiagnosticSchema = z.object({
	capturedAt: z.string().datetime(),
	backend: z.object({
		bunVersion: z.string(),
		pid: z.number().int().positive(),
		revision: z.string(),
		workingDirectory: z.string(),
	}),
	workspacePath: z.string().nullable(),
	agentDir: z.string(),
	sessionPath: z.string().nullable(),
	provider: z.string().nullable(),
	modelId: z.string().nullable(),
	auth: z.object({
		status: z.enum(["resolved", "missing", "error", "unknown"]),
		errorMessage: z.string().nullable(),
		causeMessage: z.string().nullable(),
		authFile: z.object({
			exists: z.boolean(),
			mtimeMs: z.number().nullable(),
			size: z.number().int().nonnegative().nullable(),
		}),
		authFileChanged: z.boolean(),
		presentEnvironmentVariables: z.array(z.string()),
	}),
});

export type PiWorkspaceRequest = z.infer<typeof PiWorkspaceRequestSchema>;
export type PiWorkspaceFileRequest = z.infer<typeof PiWorkspaceFileRequestSchema>;
export type PiWorkspaceFile = z.infer<typeof PiWorkspaceFileSchema>;
export type PiWorkspaceFileContent = z.infer<typeof PiWorkspaceFileContentSchema>;
export type PiWorkspacePickerResult = z.infer<typeof PiWorkspacePickerResultSchema>;
export type PiSessionSummary = z.infer<typeof PiSessionSummarySchema>;
export type PiResourceSummary = z.infer<typeof PiResourceSummarySchema>;
export type PiWorkspaceSnapshot = z.infer<typeof PiWorkspaceSnapshotSchema>;
export type PiSessionTranscriptRequest = z.infer<typeof PiSessionTranscriptRequestSchema>;
export type PiSessionCommand = z.infer<typeof PiSessionCommandSchema>;
export type PiSessionAbortRequest = z.infer<typeof PiSessionAbortRequestSchema>;
export type PiSessionModelRequest = z.infer<typeof PiSessionModelRequestSchema>;
export type PiSessionThinkingRequest = z.infer<typeof PiSessionThinkingRequestSchema>;
export type PiThinkingLevel = z.infer<typeof PiThinkingLevelSchema>;
export type PiModel = z.infer<typeof PiModelSchema>;
export type PiConversationEntry = z.infer<typeof PiConversationEntrySchema>;
export type PiSessionTranscript = z.infer<typeof PiSessionTranscriptSchema>;
export type PiSessionRuntimeState = z.infer<typeof PiSessionRuntimeStateSchema>;
export type PiOpenedSession = z.infer<typeof PiOpenedSessionSchema>;
export type PiSessionEvent = z.infer<typeof PiSessionEventSchema>;
export type PiExtensionResource = z.infer<typeof PiExtensionResourceSchema>;
export type PiResourceItem = z.infer<typeof PiResourceItemSchema>;
export type PiAuthenticationMethod = z.infer<typeof PiAuthenticationMethodSchema>;
export type PiAuthenticationStatus = z.infer<typeof PiAuthenticationStatusSchema>;
export type PiAuthenticationLoginRequest = z.infer<typeof PiAuthenticationLoginRequestSchema>;
export type PiAuthenticationCancelRequest = z.infer<typeof PiAuthenticationCancelRequestSchema>;
export type PiAuthenticationEvent = z.infer<typeof PiAuthenticationEventSchema>;
export type PiAuthenticationPromptResponse = z.infer<typeof PiAuthenticationPromptResponseSchema>;
export type PiWorkspaceRefreshResult = z.infer<typeof PiWorkspaceRefreshResultSchema>;
export type PiToolPermissionRequest = z.infer<typeof PiToolPermissionRequestSchema>;
export type PiToolPermissionResponse = z.infer<typeof PiToolPermissionResponseSchema>;
export type PiToolPermissionResolution = z.infer<typeof PiToolPermissionResolutionSchema>;
export type PiRuntimeDiagnostic = z.infer<typeof PiRuntimeDiagnosticSchema>;
