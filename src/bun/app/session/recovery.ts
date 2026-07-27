import { classifyPiError, type PiSession } from "@main/pi";

type RecoveryState = "retryable" | "awaiting-settle" | "recovering";

export class SessionRecovery {
	private readonly states = new Map<string, RecoveryState>();

	constructor(private readonly onError: (sessionPath: string, error: Error) => void) {}

	promptStarted(sessionPath: string): void {
		this.states.set(sessionPath, "retryable");
	}

	handleError(sessionPath: string, error: Error): boolean {
		if (classifyPiError(error) !== "authentication-resolution-failed") return false;
		const state = this.states.get(sessionPath);
		if (!state) return false;
		if (state === "retryable") this.states.set(sessionPath, "awaiting-settle");
		return true;
	}

	handleSettled(session: PiSession): boolean {
		const state = this.states.get(session.path);
		if (state !== "awaiting-settle") {
			this.states.delete(session.path);
			return false;
		}
		this.states.set(session.path, "recovering");
		void this.recover(session);
		return true;
	}

	clear(sessionPath: string): void {
		this.states.delete(sessionPath);
	}

	dispose(): void {
		this.states.clear();
	}

	private async recover(session: PiSession): Promise<void> {
		try {
			await session.prepareAuthenticationRetry();
			await session.requireResolvedAuthentication();
			this.states.set(session.path, "retryable");
			await session.continue();
		} catch (error) {
			this.states.delete(session.path);
			this.onError(session.path, error instanceof Error ? error : new Error("Pi OAuth 恢复失败。"));
		}
	}
}
