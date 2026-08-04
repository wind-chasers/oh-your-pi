import type { ElectrobunRPCSchema } from "electrobun/bun";
import type {
	PiAuthenticationEvent,
	PiAuthenticationCancelRequest,
	PiAuthenticationLoginRequest,
	PiAuthenticationStatus,
	PiAuthenticationPromptResponse,
	PiOpenedSession,
	PiImageAttachment,
	PiSessionAbortRequest,
	PiSessionDeleteRequest,
	PiSessionCompactRequest,
	PiSessionDropRequest,
	PiSessionForkRequest,
	PiSessionModelRequest,
	PiSessionCommand,
	PiQueuedSessionCommand,
	PiSessionEvent,
	PiSessionRegenerateRequest,
	PiSessionRuntimeState,
	PiSessionThinkingRequest,
	PiSessionTranscript,
	PiSessionRenameRequest,
	PiSessionRenameResult,
	PiSessionTranscriptRequest,
	PiWorkspacePickerResult,
	PiWorkspaceRequest,
	PiToolPermissionRequest,
	PiToolPermissionResolution,
	PiToolPermissionResponse,
	PiFileSearchRequest,
	PiFileSearchResult,
	PiWorkspaceRefreshResult,
	PiWorkspaceSnapshot,
	PiWorkspaceFile,
	PiWorkspaceFileContent,
	PiWorkspaceFileRequest,
	PiWorkspaceGit,
	PiWorkspaceGitBranchRequest,
	PiPluginSetEnabledRequest,
	PiPluginInspectionRequest,
	PiPluginSnapshot,
	PiPluginSourceRequest,
} from "./pi-contract";

export interface PiRpcSchema extends ElectrobunRPCSchema {
	bun: {
		requests: {
			loginProvider: { params: PiAuthenticationLoginRequest; response: void };
			cancelProviderLogin: { params: PiAuthenticationCancelRequest; response: void };
			respondAuthenticationPrompt: { params: PiAuthenticationPromptResponse; response: void };
			inspectAuthentication: { params: Record<string, never>; response: PiAuthenticationStatus[] };
			inspectWorkspace: { params: PiWorkspaceRequest; response: PiWorkspaceSnapshot };
			refreshWorkspaceResources: { params: PiWorkspaceRequest; response: PiWorkspaceRefreshResult };
			chooseWorkspace: { params: Record<string, never>; response: PiWorkspacePickerResult };
			openPiPackages: { params: Record<string, never>; response: void };
			chooseImageAttachments: { params: Record<string, never>; response: PiImageAttachment[] };
			listWorkspaceFiles: { params: PiWorkspaceFileRequest; response: PiWorkspaceFile[] };
			readWorkspaceFile: { params: PiWorkspaceFileRequest; response: PiWorkspaceFileContent };
			searchWorkspaceFiles: { params: PiFileSearchRequest; response: PiFileSearchResult };
			openWorkspaceFolder: { params: PiWorkspaceRequest; response: void };
			inspectWorkspaceGit: { params: PiWorkspaceRequest; response: PiWorkspaceGit | null };
			switchWorkspaceGitBranch: { params: PiWorkspaceGitBranchRequest; response: PiWorkspaceGit };
			inspectPlugins: { params: PiPluginInspectionRequest; response: PiPluginSnapshot };
			installPlugin: { params: PiPluginSourceRequest; response: PiPluginSnapshot };
			updatePlugin: { params: PiPluginSourceRequest; response: PiPluginSnapshot };
			removePlugin: { params: PiPluginSourceRequest; response: PiPluginSnapshot };
			setPluginEnabled: { params: PiPluginSetEnabledRequest; response: PiPluginSnapshot };
			readSessionTranscript: { params: PiSessionTranscriptRequest; response: PiSessionTranscript };
			openSession: { params: PiSessionTranscriptRequest; response: PiOpenedSession };
			renameSession: { params: PiSessionRenameRequest; response: PiSessionRenameResult };
			deleteSession: { params: PiSessionDeleteRequest; response: void };
			forkSession: { params: PiSessionForkRequest; response: PiOpenedSession };
			dropSession: { params: PiSessionDropRequest; response: PiOpenedSession };
			compactSession: { params: PiSessionCompactRequest; response: PiSessionRuntimeState };

			createSession: { params: PiWorkspaceRequest; response: PiOpenedSession };
			continueRecentSession: { params: PiWorkspaceRequest; response: PiOpenedSession };
			setSessionModel: { params: PiSessionModelRequest; response: PiSessionRuntimeState };
			setSessionThinking: { params: PiSessionThinkingRequest; response: PiSessionRuntimeState };
			promptSession: { params: PiSessionCommand; response: PiSessionRuntimeState };
			regenerateSessionMessage: { params: PiSessionRegenerateRequest; response: void };
			steerSession: { params: PiQueuedSessionCommand; response: PiSessionRuntimeState };
			followUpSession: { params: PiQueuedSessionCommand; response: PiSessionRuntimeState };
			abortSession: { params: PiSessionAbortRequest; response: PiSessionRuntimeState };
			respondToolPermission: { params: PiToolPermissionResponse; response: PiToolPermissionResolution };
		};
		messages: {};
	};
	webview: {
		requests: {};
		messages: {
			openAppSettings: Record<string, never>;
			sessionEvent: PiSessionEvent;
			authenticationEvent: PiAuthenticationEvent;
			toolPermissionRequest: PiToolPermissionRequest;
		};
	};
}
