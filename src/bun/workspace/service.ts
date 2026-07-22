import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { getAgentDir, ModelRuntime, SessionManager, type AgentSession, type SessionInfo } from "@earendil-works/pi-coding-agent";
import {
	PiRuntimeDiagnosticSchema,
	PiSessionCommandSchema,
	PiSessionModelRequestSchema,
	PiSessionTranscriptRequestSchema,
	PiSessionTranscriptSchema,
	PiWorkspaceRequestSchema,
	PiAuthenticationCancelRequestSchema,
	type PiAuthenticationCancelRequest,
	type PiAuthenticationEvent,
	type PiAuthenticationLoginRequest,
	type PiAuthenticationPromptResponse,
	type PiRuntimeDiagnostic,
	type PiOpenedSession,
	type PiSessionAbortRequest,
	type PiSessionCommand,
	type PiSessionModelRequest,
	type PiSessionThinkingRequest,
	type PiSessionTranscript,
	type PiSessionTranscriptRequest,
	type PiToolPermissionRequest,
	type PiToolPermissionResolution,
	type PiToolPermissionResponse,
	type PiWorkspaceRefreshResult,
	type PiWorkspaceRequest,
	type PiWorkspaceSnapshot,
} from "@shared/pi-contract";
import { PiSessionHost, PiWorkspaceHost } from "@main/pi/runtime";
import {
	isOAuthResolutionFailure,
	readAuthFileMetadata,
	toRuntimeDiagnostic,
	type AuthFileMetadata,
} from "@main/pi/diagnostics";
import { startSessionPrompt } from "@main/pi/prompt";
import { PiAuthenticationController } from "./auth";
import { PiSessionEventRelay } from "./events";
import { toConversationEntry, toSessionSummary } from "./mapper";
import { toOpenedSession, toRuntimeState } from "./presenter";
import { ToolPermissionGateway } from "./permissions";
import { inspectAuthentication, inspectWorkspaceSnapshot } from "./inspector";

type PromptDiagnostic = { authFileBefore: AuthFileMetadata; sessionPath: string };

/** Routes requests by explicit workspace/session identity; it owns no active selection. */
export class PiWorkspaceService {
	private readonly authentication = new PiAuthenticationController();
	private authenticationRuntime: Promise<ModelRuntime> | undefined;
	private readonly diagnostics = new Map<string, PiRuntimeDiagnostic>();
	private readonly eventRelay: PiSessionEventRelay;
	private readonly permissionGateway = new ToolPermissionGateway();
	private readonly promptDiagnostics = new Map<string, PromptDiagnostic>();
	private readonly pendingOAuthRecovery = new Set<string>();
	private readonly workspaces = new Map<string, PiWorkspaceHost>();

	constructor() {
		this.eventRelay = new PiSessionEventRelay({
			onAgentError: (sessionPath, error) => this.handleAgentError(sessionPath, error),
			onAgentSettled: (sessionPath) => this.handleAgentSettled(sessionPath),
		});
	}

	setEventHandler(eventHandler: (event: import("@shared/pi-contract").PiSessionEvent) => void): void {
		this.eventRelay.setEventHandler(eventHandler);
	}
	setPermissionHandler(permissionHandler: (request: PiToolPermissionRequest) => void): void {
		this.permissionGateway.setHandler(permissionHandler);
	}
	setAuthenticationEventHandler(eventHandler: (event: PiAuthenticationEvent) => void): void {
		this.authentication.setEventHandler(eventHandler);
	}

	async inspect(input: PiWorkspaceRequest): Promise<PiWorkspaceSnapshot> {
		const { workspacePath } = PiWorkspaceRequestSchema.parse(input);
		return inspectWorkspaceSnapshot(await resolveWorkspacePath(workspacePath));
	}

	async refreshResources(input: PiWorkspaceRequest): Promise<PiWorkspaceRefreshResult> {
		const { workspacePath } = PiWorkspaceRequestSchema.parse(input);
		const host = this.workspaces.get(await resolveWorkspacePath(workspacePath));
		if (host) await host.rebuildIdleSessions();
		return { snapshot: await inspectWorkspaceSnapshot(workspacePath) };
	}

	respondToolPermission(input: PiToolPermissionResponse): PiToolPermissionResolution {
		return this.permissionGateway.respond(input);
	}

	async inspectAuthentication(): Promise<import("@shared/pi-contract").PiAuthenticationStatus[]> {
		return inspectAuthentication(await this.getAuthenticationRuntime());
	}

	async loginProvider(input: PiAuthenticationLoginRequest): Promise<void> {
		await this.authentication.loginProvider(input, await this.getAuthenticationRuntime());
	}

	cancelProviderLogin(input: PiAuthenticationCancelRequest): void {
		const request = PiAuthenticationCancelRequestSchema.parse(input);
		this.authentication.cancelProviderLogin(request.provider);
	}

	respondAuthenticationPrompt(input: PiAuthenticationPromptResponse): void {
		this.authentication.respondPrompt(input);
	}


	async readTranscript(input: PiSessionTranscriptRequest): Promise<PiSessionTranscript> {
		const request = PiSessionTranscriptRequestSchema.parse(input);
		const { session, sessionManager } = await this.openReadOnlySession(request);
		return PiSessionTranscriptSchema.parse({
			session: toSessionSummary(session),
			entries: sessionManager.getBranch().flatMap(toConversationEntry),
		});
	}

	async openSession(input: PiSessionTranscriptRequest): Promise<PiOpenedSession> {
		const request = PiSessionTranscriptRequestSchema.parse(input);
		const { session, workspacePath } = await this.openReadOnlySession(request);
		return this.toOpenedSession(await (await this.getWorkspace(workspacePath)).open(SessionManager.open(session.path)));
	}

	async createSession(input: PiWorkspaceRequest): Promise<PiOpenedSession> {
		const request = PiWorkspaceRequestSchema.parse(input);
		return this.toOpenedSession(await (await this.getWorkspace(request.workspacePath)).createSession());
	}

	async continueRecentSession(input: PiWorkspaceRequest): Promise<PiOpenedSession> {
		const request = PiWorkspaceRequestSchema.parse(input);
		return this.toOpenedSession(await (await this.getWorkspace(request.workspacePath)).continueRecentSession());
	}


	async setModel(input: PiSessionModelRequest): Promise<PiOpenedSession> {
		const request = PiSessionModelRequestSchema.parse(input);
		const host = this.requireSessionHost(request.sessionPath);
		this.requireIdle(host.getSession());
		const model = host.getRuntimeState().services.modelRuntime.getModel(request.provider, request.modelId);
		if (!model) throw new Error("所选模型不在当前 Pi 配置中。");
		await host.getSession().setModel(model);
		return this.toOpenedSession(host);
	}

	async setThinking(input: PiSessionThinkingRequest): Promise<PiOpenedSession> {
		const host = this.requireSessionHost(input.sessionPath);
		this.requireIdle(host.getSession());
		host.getSession().setThinkingLevel(input.thinkingLevel as ThinkingLevel);
		return this.toOpenedSession(host);
	}

	async prompt(input: PiSessionCommand): Promise<import("@shared/pi-contract").PiSessionRuntimeState> {
		const request = PiSessionCommandSchema.parse(input);
		const host = this.requireSessionHost(request.sessionPath);
		const session = host.getSession();
		const model = session.model;
		if (!model) throw new Error("当前 Pi 会话没有可用模型。请检查认证或模型配置。");
		return this.authentication.withProviderOperation(model.provider, async () => {
			const authFileBefore = await readAuthFileMetadata(this.authFilePath(host));
			try {
				await this.requireResolvedAuthentication(host);
			} catch (error) {
				this.diagnostics.set(
					host.getSessionPath(),
					await this.captureRuntimeDiagnostic(host, "error", error, authFileBefore),
				);
				throw error;
			}
			this.promptDiagnostics.set(host.getSessionPath(), { authFileBefore, sessionPath: host.getSessionPath() });
			this.diagnostics.set(
				host.getSessionPath(),
				await this.captureRuntimeDiagnostic(host, "resolved", undefined, authFileBefore),
			);
			await startSessionPrompt(session, request.text, (error) => {
				this.recordPromptAuthenticationFailure(host.getSessionPath(), error);
				this.eventRelay.emitError(host.getSessionPath(), error);
			});
			return toRuntimeState(host.getRuntimeState(), session);
		});
	}

	async steer(input: PiSessionCommand): Promise<import("@shared/pi-contract").PiSessionRuntimeState> {
		const host = this.requireSessionHost(input.sessionPath);
		await host.getSession().steer(input.text);
		return toRuntimeState(host.getRuntimeState(), host.getSession());
	}
	async followUp(input: PiSessionCommand): Promise<import("@shared/pi-contract").PiSessionRuntimeState> {
		const host = this.requireSessionHost(input.sessionPath);
		await host.getSession().followUp(input.text);
		return toRuntimeState(host.getRuntimeState(), host.getSession());
	}
	async abort(input: PiSessionAbortRequest): Promise<import("@shared/pi-contract").PiSessionRuntimeState> {
		const host = this.requireSessionHost(input.sessionPath);
		await host.getSession().abort();
		return toRuntimeState(host.getRuntimeState(), host.getSession());
	}

	private getAuthenticationRuntime(): Promise<ModelRuntime> {
		if (this.authenticationRuntime) return this.authenticationRuntime;
		const agentDir = getAgentDir();
		this.authenticationRuntime = ModelRuntime.create({
			authPath: join(agentDir, "auth.json"),
			modelsPath: join(agentDir, "models.json"),
		});
		return this.authenticationRuntime;
	}

	private async getWorkspace(workspacePath: string): Promise<PiWorkspaceHost> {
		const resolvedWorkspacePath = await resolveWorkspacePath(workspacePath);
		const existing = this.workspaces.get(resolvedWorkspacePath);
		if (existing) return existing;
		const workspace = await PiWorkspaceHost.create({
			workspacePath: resolvedWorkspacePath,
			createExtensions: (getSessionPath) => [this.permissionGateway.createExtension(getSessionPath)],
			onSessionDispose: (sessionPath) => this.permissionGateway.resetSession(sessionPath),
			onSessionEvent: (sessionPath, event) => this.eventRelay.dispatch(sessionPath, event),
		});
		this.workspaces.set(resolvedWorkspacePath, workspace);
		return workspace;
	}

	private requireSessionHost(sessionPath: string): PiSessionHost {
		const key = resolve(sessionPath);
		for (const workspace of this.workspaces.values()) {
			try {
				return workspace.getSession(key);
			} catch {
				continue;
			}
		}
		throw new Error("该会话尚未在主进程打开。");
	}

	private async openReadOnlySession(
		request: PiSessionTranscriptRequest,
	): Promise<{ session: SessionInfo; sessionManager: SessionManager; workspacePath: string }> {
		const workspacePath = await resolveWorkspacePath(request.workspacePath);
		const sessions = await SessionManager.list(workspacePath);
		const session = sessions.find((candidate) => resolve(candidate.path) === resolve(request.sessionPath));
		if (!session) throw new Error("该会话不属于所选 Pi 工作区。");
		return { session, sessionManager: SessionManager.open(session.path), workspacePath };
	}

	private async toOpenedSession(host: PiSessionHost): Promise<PiOpenedSession> {
		return toOpenedSession(host.getRuntimeState(), host.getRuntimeState().cwd);
	}
	private requireIdle(session: AgentSession): void {
		if (!session.isIdle) throw new Error("Pi 正在运行，请完成或中止后再修改会话状态。");
	}
	private authFilePath(host: PiSessionHost): string {
		return join(host.getRuntimeState().services.agentDir, "auth.json");
	}
	private async requireResolvedAuthentication(host: PiSessionHost): Promise<void> {
		const model = host.getSession().model;
		if (!model || !(await host.getRuntimeState().services.modelRuntime.getAuth(model)))
			throw new Error("Pi 无法解析当前模型的认证信息。");
	}
	private async captureRuntimeDiagnostic(
		host: PiSessionHost,
		authStatus: PiRuntimeDiagnostic["auth"]["status"],
		authError?: unknown,
		authFileBefore?: AuthFileMetadata,
	): Promise<PiRuntimeDiagnostic> {
		const runtime = host.getRuntimeState();
		return PiRuntimeDiagnosticSchema.parse(
			toRuntimeDiagnostic({
				agentDir: runtime.services.agentDir,
				authError,
				authFileAfter: await readAuthFileMetadata(this.authFilePath(host)),
				authFileBefore,
				authStatus,
				modelId: host.getSession().model?.id ?? null,
				provider: host.getSession().model?.provider ?? null,
				sessionPath: host.getSessionPath(),
				workspacePath: runtime.cwd,
			}),
		);
	}
	private recordPromptAuthenticationFailure(sessionPath: string, error: unknown): void {
		const host = this.requireSessionHost(sessionPath);
		const prompt = this.promptDiagnostics.get(sessionPath);
		if (!prompt) return;
		void this.captureRuntimeDiagnostic(host, "error", error, prompt.authFileBefore)
			.then((value) => this.diagnostics.set(sessionPath, value))
			.catch(() => undefined);
	}
	private handleAgentError(sessionPath: string, error: Error): boolean {
		if (
			!isOAuthResolutionFailure(error) ||
			this.pendingOAuthRecovery.has(sessionPath) ||
			!this.promptDiagnostics.has(sessionPath)
		)
			return false;
		this.pendingOAuthRecovery.add(sessionPath);
		return true;
	}
	private handleAgentSettled(sessionPath: string): boolean {
		if (!this.pendingOAuthRecovery.delete(sessionPath)) {
			this.promptDiagnostics.delete(sessionPath);
			return false;
		}
		void this.retryOAuthPrompt(sessionPath).catch((error) => this.eventRelay.emitError(sessionPath, error));
		return true;
	}
	private async retryOAuthPrompt(sessionPath: string): Promise<void> {
		const host = this.requireSessionHost(sessionPath);
		const session = host.getSession();
		this.requireIdle(session);
		const failed = session.sessionManager.getEntry(session.sessionManager.getLeafId() ?? "");
		if (failed?.type !== "message" || failed.message.role !== "assistant" || !failed.parentId)
			throw new Error("Pi 无法恢复 OAuth 失败前的用户消息；请重新发送。");
		await session.navigateTree(failed.parentId, { summarize: false });
		const authFileBefore = await readAuthFileMetadata(this.authFilePath(host));
		await this.requireResolvedAuthentication(host);
		this.promptDiagnostics.set(sessionPath, { authFileBefore, sessionPath });
		this.diagnostics.set(sessionPath, await this.captureRuntimeDiagnostic(host, "resolved", undefined, authFileBefore));
		await session.agent.continue();
	}
}

async function resolveWorkspacePath(workspacePath: string): Promise<string> {
	const resolvedWorkspacePath = resolve(workspacePath);
	if (!(await stat(resolvedWorkspacePath)).isDirectory())
		throw new Error(`Pi 工作区不是目录：${resolvedWorkspacePath}`);
	return resolvedWorkspacePath;
}
