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
	PiSessionModelRequest,
	PiSessionCommand,
	PiSessionEvent,
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
	PiWorkspaceRefreshResult,
	PiWorkspaceSnapshot,
	PiWorkspaceFile,
	PiWorkspaceFileContent,
	PiWorkspaceFileRequest,
	PiWorkspaceGit,
	PiWorkspaceGitBranchRequest,
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
			chooseImageAttachments: { params: Record<string, never>; response: PiImageAttachment[] };
			listWorkspaceFiles: { params: PiWorkspaceFileRequest; response: PiWorkspaceFile[] };
			readWorkspaceFile: { params: PiWorkspaceFileRequest; response: PiWorkspaceFileContent };
			openWorkspaceFolder: { params: PiWorkspaceRequest; response: void };
			inspectWorkspaceGit: { params: PiWorkspaceRequest; response: PiWorkspaceGit | null };
			switchWorkspaceGitBranch: { params: PiWorkspaceGitBranchRequest; response: PiWorkspaceGit };
			readSessionTranscript: { params: PiSessionTranscriptRequest; response: PiSessionTranscript };
			openSession: { params: PiSessionTranscriptRequest; response: PiOpenedSession };
			renameSession: { params: PiSessionRenameRequest; response: PiSessionRenameResult };
			deleteSession: { params: PiSessionDeleteRequest; response: void };
			createSession: { params: PiWorkspaceRequest; response: PiOpenedSession };
			continueRecentSession: { params: PiWorkspaceRequest; response: PiOpenedSession };
			setSessionModel: { params: PiSessionModelRequest; response: PiOpenedSession };
			setSessionThinking: { params: PiSessionThinkingRequest; response: PiOpenedSession };
			promptSession: { params: PiSessionCommand; response: PiSessionRuntimeState };
			steerSession: { params: PiSessionCommand; response: PiSessionRuntimeState };
			followUpSession: { params: PiSessionCommand; response: PiSessionRuntimeState };
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
