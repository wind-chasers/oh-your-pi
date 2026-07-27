import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ChatSession } from "./session";
import { chatStore } from "./store";
import type { ChatSessionSnapshot } from "./types";

export { ChatSession } from "./session";
export { SessionView, getSessionViewItemKey } from "./session-view";
export type { SessionViewItem, SessionViewToolCall } from "./session-view";
export { ChatStore, chatStore } from "./store";
export {
	DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS,
	DEFAULT_SESSION_SWEEP_INTERVAL_MS,
} from "./types";
export type {
	ChatSessionActivity,
	ChatSessionPhase,
	ChatSessionSnapshot,
	ChatStoreOptions,
	ChatToolCall,
	ChatToolExecutionStatus,
} from "./types";
export { ChatWorkspace } from "./workspace";

export function useChatSession(
	workspacePath: string,
	sessionId: string,
	sessionPath: string,
): readonly [ChatSessionSnapshot, ChatSession] {
	const session = useMemo(
		() => chatStore.session(workspacePath, sessionId, sessionPath),
		[workspacePath, sessionId, sessionPath],
	);
	useEffect(() => {
		const release = session.acquire();
		void session.open().catch(() => undefined);
		return release;
	}, [session]);

	const snapshot = useSyncExternalStore(
		session.subscribe,
		session.getSnapshot,
		session.getSnapshot,
	);

	return [snapshot, session] as const;
}
