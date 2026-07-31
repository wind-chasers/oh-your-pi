import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { ModelRuntime, SessionInfo, SessionManager } from "@earendil-works/pi-coding-agent";
import { PiError, toError } from "../errors";
import type { PiSessionHooks } from "./hooks";
import { PiSession } from "./session";

export class PiSessionRegistry {
	private disposed = false;
	private readonly deleting = new Map<string, Promise<void>>();
	private readonly opening = new Map<string, Promise<PiSession>>();
	private readonly sessions = new Map<string, PiSession>();

	constructor(
		private readonly agentDir: string,
		private readonly modelRuntime: ModelRuntime,
	) {}

	get(sessionPath: string): PiSession {
		const session = this.sessions.get(resolve(sessionPath));
		if (!session) throw new Error("该会话尚未在主进程打开。");
		return session;
	}

	find(sessionPath: string): PiSession | undefined {
		return this.sessions.get(resolve(sessionPath));
	}

	async open(options: {
		hooks: PiSessionHooks;
		sessionInfo?: SessionInfo;
		sessionManager: SessionManager;
		workspacePath: string;
	}): Promise<PiSession> {
		if (this.disposed) throw new PiError("session-closed", "Pi runtime 已经关闭。");
		const sessionPath = options.sessionManager.getSessionFile();
		if (!sessionPath) throw new PiError("session-not-persisted", "Pi 未创建持久化会话文件。");
		const key = resolve(sessionPath);
		if (this.deleting.has(key)) {
			throw new PiError("session-closed", "该 Pi 会话正在删除。");
		}
		const existing = this.sessions.get(key);
		if (existing) return existing;
		const pending = this.opening.get(key);
		if (pending) return pending;

		const opening = PiSession.create({
			agentDir: this.agentDir,
			hooks: options.hooks,
			modelRuntime: this.modelRuntime,
			sessionInfo: options.sessionInfo,
			sessionManager: options.sessionManager,
			workspacePath: options.workspacePath,
		});
		this.opening.set(key, opening);
		try {
			const session = await opening;
			this.sessions.set(key, session);
			return session;
		} finally {
			this.opening.delete(key);
		}
	}

	async close(sessionPath: string): Promise<void> {
		const key = resolve(sessionPath);
		const opening = this.opening.get(key);
		if (opening) await opening.catch(() => undefined);
		const session = this.sessions.get(key);
		if (!session) return;
		this.sessions.delete(key);
		await session.dispose();
	}

	async delete(sessionPath: string): Promise<void> {
		if (this.disposed) throw new PiError("session-closed", "Pi runtime 已经关闭。");
		const key = resolve(sessionPath);
		const pending = this.deleting.get(key);
		if (pending) return pending;

		const deleting = this.deleteSession(key);
		this.deleting.set(key, deleting);
		try {
			await deleting;
		} finally {
			this.deleting.delete(key);
		}
	}

	async rebuildIdleSessions(workspacePath: string): Promise<void> {
		const resolvedWorkspacePath = resolve(workspacePath);
		for (const session of this.sessions.values()) {
			if (resolve(session.workspacePath) === resolvedWorkspacePath && session.isIdle) await session.rebuild();
		}
	}

	async dispose(): Promise<void> {
		if (this.disposed) return;
		this.disposed = true;
		await Promise.allSettled([...this.opening.values(), ...this.deleting.values()]);
		const sessions = [...this.sessions.values()];
		this.sessions.clear();
		const results = await Promise.allSettled(sessions.map((session) => session.dispose()));
		const errors = results
			.filter((result): result is PromiseRejectedResult => result.status === "rejected")
			.map((result) => result.reason);
		if (errors.length > 0) throw toError(errors[0], "部分 Pi 会话无法正常关闭。");
	}

	private async deleteSession(key: string): Promise<void> {
		const opening = this.opening.get(key);
		if (opening) await opening.catch(() => undefined);
		const session = this.sessions.get(key);
		if (session && !session.isIdle) {
			throw new Error("Pi 正在运行，请完成或中止后再删除会话。");
		}
		if (session) {
			this.sessions.delete(key);
			await session.dispose();
		}
		await rm(key, { force: true });
	}
}
