import type { PiOpenedSession, PiSessionEvent, PiToolPermissionRequest } from "@shared/pi-contract";
import { continueRecentPiSession, createPiSession } from "@view/lib/pi-client";
import { ChatSession } from "./session";
import { requireValue } from "./utils";

export class ChatWorkspace {
	private readonly sessions = new Map<string, ChatSession>();
	private operationCount = 0;
	private disposed = false;

	public constructor(
		public readonly path: string,
		private readonly inactivityTimeoutMs: number,
		private readonly now: () => number,
	) {
		requireValue(path, "workspacePath");
	}

	public session(sessionId: string, sessionPath: string): ChatSession {
		this.assertUsable();
		requireValue(sessionId, "sessionId");
		requireValue(sessionPath, "sessionPath");
		const existing = this.sessions.get(sessionId);
		if (existing) {
			if (existing.path !== sessionPath) {
				throw new Error(`会话 ${sessionId} 的路径与已有记录不一致。`);
			}
			return existing;
		}
		const pathOwner = this.findSessionByPath(sessionPath);
		if (pathOwner) {
			throw new Error(`会话路径 ${sessionPath} 已属于会话 ${pathOwner.id}。`);
		}
		const session = new ChatSession(this.path, sessionId, sessionPath, this.now);
		this.sessions.set(sessionId, session);
		return session;
	}

	public getSession(sessionId: string): ChatSession | undefined {
		return this.sessions.get(sessionId);
	}

	public removeSession(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		this.sessions.delete(sessionId);
		session.dispose();
	}

	public getSessions(): readonly ChatSession[] {
		return [...this.sessions.values()];
	}

	public async openSession(sessionId: string, sessionPath: string): Promise<ChatSession> {
		const session = this.session(sessionId, sessionPath);
		await session.open();
		return session;
	}

	public async createSession(): Promise<ChatSession> {
		return this.runSessionOperation(async () => {
			const openedSession = await createPiSession({ workspacePath: this.path });
			return this.installOpenedSession(openedSession);
		});
	}

	public async continueRecentSession(): Promise<ChatSession> {
		return this.runSessionOperation(async () => {
			const openedSession = await continueRecentPiSession({ workspacePath: this.path });
			return this.installOpenedSession(openedSession);
		});
	}

	public acceptEvent(event: PiSessionEvent): boolean {
		if (this.disposed) return false;
		const session = this.findSessionByPath(event.sessionPath);
		if (!session) return false;
		session.acceptEvent(event);
		return true;
	}

	public acceptPermission(request: PiToolPermissionRequest): boolean {
		if (this.disposed) return false;
		const session = this.findSessionByPath(request.sessionPath);
		if (!session) return false;
		session.acceptPermission(request);
		return true;
	}

	public evictInactive(now = this.now()): number {
		let evicted = 0;
		for (const [sessionId, session] of this.sessions) {
			if (!session.canEvict(now, this.inactivityTimeoutMs)) continue;
			this.sessions.delete(sessionId);
			session.dispose();
			evicted += 1;
		}
		return evicted;
	}

	public get isDisposable(): boolean {
		return this.sessions.size === 0 && this.operationCount === 0;
	}

	public dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const session of this.sessions.values()) session.dispose();
		this.sessions.clear();
	}

	private installOpenedSession(openedSession: PiOpenedSession): ChatSession {
		this.assertUsable();
		const session = this.session(
			openedSession.runtime.sessionId,
			openedSession.runtime.sessionPath,
		);
		session.hydrate(openedSession);
		return session;
	}

	private findSessionByPath(sessionPath: string): ChatSession | undefined {
		for (const session of this.sessions.values()) {
			if (session.path === sessionPath) return session;
		}
		return undefined;
	}

	private async runSessionOperation(
		operation: () => Promise<ChatSession>,
	): Promise<ChatSession> {
		this.assertUsable();
		this.operationCount += 1;
		try {
			return await operation();
		} finally {
			this.operationCount -= 1;
		}
	}

	private assertUsable(): void {
		if (this.disposed) throw new Error("该工作区已从 Chat Store 中释放。");
	}
}
