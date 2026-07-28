import { Electroview } from "electrobun/view";
import type {
	PiAuthenticationEvent,
	PiAuthenticationCancelRequest,
	PiAuthenticationLoginRequest,
	PiAuthenticationStatus,
	PiAuthenticationPromptResponse,
	PiOpenedSession,
	PiImageAttachment,
	PiSessionAbortRequest,
	PiSessionCommand,
	PiSessionEvent,
	PiSessionModelRequest,
	PiSessionRuntimeState,
	PiSessionThinkingRequest,
	PiSessionTranscript,
	PiSessionTranscriptRequest,
	PiWorkspacePickerResult,
	PiWorkspaceRequest,
	PiToolPermissionRequest,
	PiToolPermissionResolution,
	PiToolPermissionResponse,
	PiWorkspaceRefreshResult,
	PiWorkspaceFile,
	PiWorkspaceFileContent,
	PiWorkspaceFileRequest,
	PiWorkspaceSnapshot,
} from "@shared/pi-contract";
import type { PiRpcSchema } from "@shared/pi-rpc";

const rpc = Electroview.defineRPC<PiRpcSchema>({
	maxRequestTime: Infinity,
	handlers: {},
});

if (window.__electrobun) new Electroview({ rpc });

export function subscribeToOpenAppSettings(listener: () => void): () => void {
	const handleMessage = () => listener();
	rpc.addMessageListener("openAppSettings", handleMessage);
	return () => rpc.removeMessageListener("openAppSettings", handleMessage);
}

export function subscribeToPiSessionEvents(listener: (event: PiSessionEvent) => void): () => void {
	rpc.addMessageListener("sessionEvent", listener);
	return () => rpc.removeMessageListener("sessionEvent", listener);
}

export function subscribeToPiToolPermissionRequests(listener: (request: PiToolPermissionRequest) => void): () => void {
	rpc.addMessageListener("toolPermissionRequest", listener);
	return () => rpc.removeMessageListener("toolPermissionRequest", listener);
}

export function subscribeToPiAuthenticationEvents(listener: (event: PiAuthenticationEvent) => void): () => void {
	rpc.addMessageListener("authenticationEvent", listener);
	return () => rpc.removeMessageListener("authenticationEvent", listener);
}

export async function inspectPiWorkspace(request: PiWorkspaceRequest): Promise<PiWorkspaceSnapshot> {
	return rpc.request.inspectWorkspace(request);
}

export async function refreshPiWorkspaceResources(request: PiWorkspaceRequest): Promise<PiWorkspaceRefreshResult> {
	return rpc.request.refreshWorkspaceResources(request);
}

export async function inspectPiAuthentication(): Promise<PiAuthenticationStatus[]> {
	return rpc.request.inspectAuthentication({});
}

export async function loginPiProvider(request: PiAuthenticationLoginRequest): Promise<void> {
	return rpc.request.loginProvider(request);
}

export async function cancelPiProviderLogin(request: PiAuthenticationCancelRequest): Promise<void> {
	return rpc.request.cancelProviderLogin(request);
}

export async function respondPiAuthenticationPrompt(request: PiAuthenticationPromptResponse): Promise<void> {
	return rpc.request.respondAuthenticationPrompt(request);
}


export async function choosePiImageAttachments(): Promise<PiImageAttachment[]> {
	return rpc.request.chooseImageAttachments({});
}

export async function choosePiWorkspace(): Promise<PiWorkspacePickerResult> {
	return rpc.request.chooseWorkspace({});
}


export async function listPiWorkspaceFiles(request: PiWorkspaceFileRequest): Promise<PiWorkspaceFile[]> {
	return rpc.request.listWorkspaceFiles(request);
}

export async function readPiWorkspaceFile(request: PiWorkspaceFileRequest): Promise<PiWorkspaceFileContent> {
	return rpc.request.readWorkspaceFile(request);
}

export async function readPiSessionTranscript(request: PiSessionTranscriptRequest): Promise<PiSessionTranscript> {
	return rpc.request.readSessionTranscript(request);
}


export async function openPiSession(request: PiSessionTranscriptRequest): Promise<PiOpenedSession> {
	return rpc.request.openSession(request);
}

export async function createPiSession(request: PiWorkspaceRequest): Promise<PiOpenedSession> {
	return rpc.request.createSession(request);
}

export async function continueRecentPiSession(request: PiWorkspaceRequest): Promise<PiOpenedSession> {
	return rpc.request.continueRecentSession(request);
}




export async function setPiSessionModel(request: PiSessionModelRequest): Promise<PiOpenedSession> {
	return rpc.request.setSessionModel(request);
}

export async function setPiSessionThinking(request: PiSessionThinkingRequest): Promise<PiOpenedSession> {
	return rpc.request.setSessionThinking(request);
}



export async function promptPiSession(request: PiSessionCommand): Promise<PiSessionRuntimeState> {
	return rpc.request.promptSession(request);
}

export async function steerPiSession(request: PiSessionCommand): Promise<PiSessionRuntimeState> {
	return rpc.request.steerSession(request);
}

export async function followUpPiSession(request: PiSessionCommand): Promise<PiSessionRuntimeState> {
	return rpc.request.followUpSession(request);
}

export async function abortPiSession(request: PiSessionAbortRequest): Promise<PiSessionRuntimeState> {
	return rpc.request.abortSession(request);
}

export async function respondToPiToolPermission(
	request: PiToolPermissionResponse,
): Promise<PiToolPermissionResolution> {
	return rpc.request.respondToolPermission(request);
}
