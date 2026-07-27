import type {
	PiOpenedSession,
	PiSessionAbortRequest,
	PiSessionCommand,
	PiSessionEvent as AppSessionEvent,
	PiSessionModelRequest,
	PiSessionRuntimeState,
	PiSessionSummary,
	PiSessionThinkingRequest,
	PiSessionTranscript,
	PiSessionTranscriptRequest,
	PiToolPermissionRequest,
	PiToolPermissionResolution,
	PiToolPermissionResponse,
	PiWorkspaceRequest,
} from "@shared/pi-contract";
import type { PiRuntime, PiSession, PiSessionEvent, PiSessionHooks } from "@main/pi";
import type { AuthenticationApplication } from "@main/app/authentication";
import { toAppSessionEvents } from "./events";
import { ToolPermissionApplication } from "./permissions";
import { SessionRecovery } from "./recovery";

type SessionEventListener = (event: AppSessionEvent) => void;
type PermissionListener = (request: PiToolPermissionRequest) => void;

export class SessionApplication {
	private disposed = false;
	private readonly listeners = new Set<SessionEventListener>();
	private readonly permissions = new ToolPermissionApplication();
	private readonly recovery = new SessionRecovery((sessionPath, error) => {
		this.emit({ sessionPath, type: "error", errorMessage: error.message });
	});
	private readonly sessionSubscriptions = new Map<string, () => void>();

	constructor(
		private readonly pi: PiRuntime,
		private readonly authentication: AuthenticationApplication,
	) {}

	async list(workspacePath: string): Promise<PiSessionSummary[]> {
		const workspace = await this.pi.openWorkspace(workspacePath);
		return workspace.listSessions();
	}

	async readTranscript(input: PiSessionTranscriptRequest): Promise<PiSessionTranscript> {
		const workspace = await this.pi.openWorkspace(input.workspacePath);
		return workspace.readSession(input.sessionPath);
	}

	async open(input: PiSessionTranscriptRequest): Promise<PiOpenedSession> {
		const workspace = await this.pi.openWorkspace(input.workspacePath);
		const session = await workspace.openSession(input.sessionPath, this.createSessionHooks());
		this.attachSession(session);
		return session.getSnapshot();
	}

	async create(input: PiWorkspaceRequest): Promise<PiOpenedSession> {
		const workspace = await this.pi.openWorkspace(input.workspacePath);
		const session = await workspace.createSession(this.createSessionHooks());
		this.attachSession(session);
		return session.getSnapshot();
	}

	async continueRecent(input: PiWorkspaceRequest): Promise<PiOpenedSession> {
		const workspace = await this.pi.openWorkspace(input.workspacePath);
		const session = await workspace.continueRecentSession(this.createSessionHooks());
		this.attachSession(session);
		return session.getSnapshot();
	}

	async setModel(input: PiSessionModelRequest): Promise<PiOpenedSession> {
		const session = this.pi.getSession(input.sessionPath);
		this.requireIdle(session);
		await session.setModel(input.provider, input.modelId);
		return session.getSnapshot();
	}

	async setThinking(input: PiSessionThinkingRequest): Promise<PiOpenedSession> {
		const session = this.pi.getSession(input.sessionPath);
		this.requireIdle(session);
		session.setThinking(input.thinkingLevel);
		return session.getSnapshot();
	}

	async prompt(input: PiSessionCommand): Promise<PiSessionRuntimeState> {
		const session = this.pi.getSession(input.sessionPath);
		const provider = session.provider;
		if (!provider) throw new Error("当前 Pi 会话没有可用模型。请检查认证或模型配置。");
		return this.authentication.withProviderOperation(provider, async () => {
			await session.requireResolvedAuthentication();
			this.recovery.promptStarted(session.path);
			await session.prompt(input.text);
			return session.getSnapshot().runtime;
		});
	}

	async steer(input: PiSessionCommand): Promise<PiSessionRuntimeState> {
		const session = this.pi.getSession(input.sessionPath);
		await session.steer(input.text);
		return session.getSnapshot().runtime;
	}

	async followUp(input: PiSessionCommand): Promise<PiSessionRuntimeState> {
		const session = this.pi.getSession(input.sessionPath);
		await session.followUp(input.text);
		return session.getSnapshot().runtime;
	}

	async abort(input: PiSessionAbortRequest): Promise<PiSessionRuntimeState> {
		const session = this.pi.getSession(input.sessionPath);
		await session.abort();
		this.recovery.clear(session.path);
		return session.getSnapshot().runtime;
	}

	respondPermission(input: PiToolPermissionResponse): PiToolPermissionResolution {
		return this.permissions.respond(input);
	}

	subscribe(listener: SessionEventListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	subscribePermissions(listener: PermissionListener): () => void {
		return this.permissions.subscribe(listener);
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const unsubscribe of this.sessionSubscriptions.values()) unsubscribe();
		this.sessionSubscriptions.clear();
		this.permissions.dispose();
		this.recovery.dispose();
		this.listeners.clear();
	}

	private createSessionHooks(): PiSessionHooks {
		return {
			beforeToolCall: (call) => this.permissions.beforeToolCall(call),
		};
	}

	private attachSession(session: PiSession): void {
		if (this.sessionSubscriptions.has(session.path)) return;
		this.sessionSubscriptions.set(
			session.path,
			session.subscribe((event) => this.handleSessionEvent(session, event)),
		);
	}

	private handleSessionEvent(session: PiSession, event: PiSessionEvent): void {
		if (event.type === "agent_settled" && this.recovery.handleSettled(session)) return;
		for (const appEvent of toAppSessionEvents(session.path, event)) {
			if (
				appEvent.type === "error"
				&& this.recovery.handleError(session.path, new Error(appEvent.errorMessage))
			) {
				continue;
			}
			this.emit(appEvent);
		}
	}

	private emit(event: AppSessionEvent): void {
		for (const listener of this.listeners) listener(event);
	}

	private requireIdle(session: PiSession): void {
		if (!session.isIdle) throw new Error("Pi 正在运行，请完成或中止后再修改会话状态。");
	}
}
