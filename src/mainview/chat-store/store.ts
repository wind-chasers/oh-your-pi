import type { PiSessionEvent, PiToolPermissionRequest } from "@shared/pi-contract";
import {
	subscribeToPiSessionEvents,
	subscribeToPiToolPermissionRequests,
} from "@view/lib/pi-client";
import type { ChatSession } from "./session";
import {
	DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS,
	DEFAULT_SESSION_SWEEP_INTERVAL_MS,
} from "./types";
import type { ChatStoreOptions } from "./types";
import { requireValue } from "./utils";
import { ChatWorkspace } from "./workspace";

export class ChatStore {
	private readonly workspaces = new Map<string, ChatWorkspace>();
	private readonly inactivityTimeoutMs: number;
	private readonly sweepIntervalMs: number;
	private readonly now: () => number;
	private unsubscribeEvents: (() => void) | undefined;
	private unsubscribePermissions: (() => void) | undefined;
	private sweepTimer: ReturnType<typeof setInterval> | undefined;
	private started = false;
	private disposed = false;

	public constructor(options: ChatStoreOptions = {}) {
		this.inactivityTimeoutMs = options.inactivityTimeoutMs
			?? DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS;
		this.sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SESSION_SWEEP_INTERVAL_MS;
		this.now = options.now ?? Date.now;
		if (this.inactivityTimeoutMs < 0 || this.sweepIntervalMs < 0) {
			throw new Error("Chat Store 的超时时间不能为负数。");
		}
	}

	public workspace(workspacePath: string): ChatWorkspace {
		this.ensureStarted();
		requireValue(workspacePath, "workspacePath");
		let workspace = this.workspaces.get(workspacePath);
		if (!workspace) {
			workspace = new ChatWorkspace(workspacePath, this.inactivityTimeoutMs, this.now);
			this.workspaces.set(workspacePath, workspace);
		}
		return workspace;
	}

	public getWorkspace(workspacePath: string): ChatWorkspace | undefined {
		return this.workspaces.get(workspacePath);
	}

	public session(
		workspacePath: string,
		sessionId: string,
		sessionPath: string,
	): ChatSession {
		return this.workspace(workspacePath).session(sessionId, sessionPath);
	}

	public getSession(workspacePath: string, sessionId: string): ChatSession | undefined {
		return this.workspaces.get(workspacePath)?.getSession(sessionId);
	}

	public removeSession(workspacePath: string, sessionId: string): void {
		this.workspaces.get(workspacePath)?.removeSession(sessionId);
	}

	public openSession(
		workspacePath: string,
		sessionId: string,
		sessionPath: string,
	): Promise<ChatSession> {
		return this.workspace(workspacePath).openSession(sessionId, sessionPath);
	}

	public createSession(workspacePath: string): Promise<ChatSession> {
		return this.workspace(workspacePath).createSession();
	}

	public continueRecentSession(workspacePath: string): Promise<ChatSession> {
		return this.workspace(workspacePath).continueRecentSession();
	}

	public evictInactive(now = this.now()): number {
		let evicted = 0;
		for (const [workspacePath, workspace] of this.workspaces) {
			evicted += workspace.evictInactive(now);
			if (workspace.isDisposable) {
				workspace.dispose();
				this.workspaces.delete(workspacePath);
			}
		}
		return evicted;
	}

	public dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.unsubscribeEvents?.();
		this.unsubscribePermissions?.();
		this.unsubscribeEvents = undefined;
		this.unsubscribePermissions = undefined;
		if (this.sweepTimer) clearInterval(this.sweepTimer);
		this.sweepTimer = undefined;
		for (const workspace of this.workspaces.values()) workspace.dispose();
		this.workspaces.clear();
	}

	private ensureStarted(): void {
		if (this.disposed) throw new Error("Chat Store 已释放，不能再次使用。");
		if (this.started) return;
		this.started = true;
		this.unsubscribeEvents = subscribeToPiSessionEvents(this.acceptEvent.bind(this));
		this.unsubscribePermissions = subscribeToPiToolPermissionRequests(this.acceptPermission.bind(this));
		if (this.sweepIntervalMs > 0) {
			this.sweepTimer = setInterval(() => this.evictInactive(), this.sweepIntervalMs);
		}
	}

	// Todo  event 带上 workspace 和 session id
	private acceptEvent(event: PiSessionEvent): void {
		for (const workspace of this.workspaces.values()) {
			if (workspace.acceptEvent(event)) return;
		}
	}

	// Todo  event 带上 workspace 和 session id
	private acceptPermission(request: PiToolPermissionRequest): void {
		for (const workspace of this.workspaces.values()) {
			if (workspace.acceptPermission(request)) return;
		}
	}
}

export const chatStore = new ChatStore();
