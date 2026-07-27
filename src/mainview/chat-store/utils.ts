import type { PiOpenedSession, PiSessionRuntimeState } from "@shared/pi-contract";

export function assertOpenedSessionIdentity(
	openedSession: PiOpenedSession,
	workspacePath: string,
	sessionId: string,
	sessionPath: string,
): void {
	if (openedSession.runtime.sessionId !== sessionId
		|| openedSession.transcript.session.id !== sessionId) {
		throw new Error(`主进程返回了错误的会话 ID：${openedSession.runtime.sessionId}`);
	}
	if (openedSession.runtime.sessionPath !== sessionPath
		|| openedSession.transcript.session.path !== sessionPath) {
		throw new Error(`主进程返回了错误的会话路径：${openedSession.runtime.sessionPath}`);
	}
	if (openedSession.transcript.session.workspacePath !== workspacePath) {
		throw new Error(`会话 ${sessionId} 不属于工作区 ${workspacePath}`);
	}
}

export function withRuntime(
	openedSession: PiOpenedSession,
	patch: Partial<PiSessionRuntimeState>,
): PiOpenedSession {
	return {
		...openedSession,
		runtime: { ...openedSession.runtime, ...patch },
	};
}

export function haveSameDependencies(
	left: readonly unknown[],
	right: readonly unknown[],
): boolean {
	return left.length === right.length
		&& left.every((dependency, index) => Object.is(dependency, right[index]));
}

export function requireText(text: string): string {
	const value = text.trim();
	if (!value) throw new Error("消息不能为空。");
	return value;
}

export function requireValue(value: string, name: string): string {
	if (!value.trim()) throw new Error(`${name} 不能为空。`);
	return value;
}

export function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
