import { expect, test } from "bun:test";
import type { PiOpenedSession } from "@shared/pi-contract";
import { SessionSnapshot } from "./snapshot";

function openedSession(): PiOpenedSession {
	return {
		runtime: {
			sessionId: "session-id",
			sessionPath: "/workspace/session.jsonl",
			isStreaming: false,
			sessionName: undefined,
			model: undefined,
			models: [],
			thinkingLevel: "off",
			availableThinkingLevels: ["off"],
		},
		transcript: {
			session: {
				id: "session-id",
				path: "/workspace/session.jsonl",
				workspacePath: "/workspace",
				name: undefined,
				firstMessage: "开始",
				messageCount: 0,
				modifiedAt: "2026-07-30T00:00:00.000Z",
			},
			entries: [],
		},
	};
}

test("SessionSnapshot 不可变地发布数据变更", () => {
	const snapshot = new SessionSnapshot("/workspace", "session-id", "/workspace/session.jsonl");
	const before = snapshot.get();
	let notifications = 0;
	snapshot.subscribe(() => { notifications += 1; });

	snapshot.edit((draft) => { draft.phase = "loading"; });

	expect(snapshot.get()).not.toBe(before);
	expect(snapshot.get().phase).toBe("loading");
	expect(before.phase).toBe("idle");
	expect(notifications).toBe(1);
});

test("SessionSnapshot transaction 只发布一次批量变更", () => {
	const snapshot = new SessionSnapshot("/workspace", "session-id", "/workspace/session.jsonl");
	let notifications = 0;
	snapshot.subscribe(() => { notifications += 1; });

	snapshot.transaction(() => {
		snapshot.edit((draft) => { draft.phase = "loading"; });
		snapshot.edit((draft) => { draft.isRefreshing = true; });
	});

	expect(snapshot.get()).toMatchObject({ phase: "loading", isRefreshing: true });
	expect(notifications).toBe(1);
});

test("SessionSnapshot 封装加载与运行时状态转换", () => {
	const snapshot = new SessionSnapshot("/workspace", "session-id", "/workspace/session.jsonl");

	snapshot.startLoading();
	expect(snapshot.get()).toMatchObject({ phase: "loading", isRefreshing: false, error: null });

	snapshot.failLoading("加载失败");
	expect(snapshot.get()).toMatchObject({ phase: "failed", isRefreshing: false, error: "加载失败" });

	const opened = openedSession();
	snapshot.hydrate(opened);
	const transcript = opened.transcript;
	expect(snapshot.get()).toMatchObject({ phase: "ready", openedSession: opened, error: null });

	snapshot.startLoading();
	expect(snapshot.get()).toMatchObject({ phase: "ready", isRefreshing: true });

	const runtime = { ...opened.runtime, isStreaming: true };
	snapshot.setRuntime(runtime);
	snapshot.setSending(true);
	expect(snapshot.get().openedSession?.runtime).toEqual(runtime);
	expect(snapshot.get().openedSession?.transcript).toBe(transcript);
	expect(snapshot.get().isSending).toBeTrue();
});
