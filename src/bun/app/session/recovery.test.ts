import { expect, mock, test } from "bun:test";
import type { PiSession } from "@main/pi";
import { SessionRecovery } from "./recovery";

function createSession(overrides: Partial<PiSession> = {}): PiSession {
	return {
		path: "/tmp/session.jsonl",
		workspacePath: "/tmp/workspace",
		provider: "github-copilot",
		isIdle: true,
		prepareAuthenticationRetry: async () => {},
		requireResolvedAuthentication: async () => {},
		continue: async () => {},
		...overrides,
	} as PiSession;
}

test("只在 prompt 后接管认证解析失败", () => {
	const recovery = new SessionRecovery(() => {});
	const error = new Error("OAuth refresh failed for github-copilot");
	expect(recovery.handleError("/tmp/session.jsonl", error)).toBe(false);
	recovery.promptStarted("/tmp/session.jsonl");
	expect(recovery.handleError("/tmp/session.jsonl", error)).toBe(true);
	expect(recovery.handleError("/tmp/session.jsonl", new Error("rate limit"))).toBe(false);
});

test("agent settled 后回退失败消息并继续会话", async () => {
	const { promise: continued, resolve } = Promise.withResolvers<void>();
	const prepareAuthenticationRetry = mock(async () => {});
	const requireResolvedAuthentication = mock(async () => {});
	const session = createSession({
		prepareAuthenticationRetry,
		requireResolvedAuthentication,
		continue: async () => resolve(),
	});
	const recovery = new SessionRecovery(() => {});
	recovery.promptStarted(session.path);
	recovery.handleError(session.path, new Error("OAuth auth derivation failed for github-copilot"));

	expect(recovery.handleSettled(session)).toBe(true);
	await continued;
	expect(prepareAuthenticationRetry).toHaveBeenCalledTimes(1);
	expect(requireResolvedAuthentication).toHaveBeenCalledTimes(1);
});
