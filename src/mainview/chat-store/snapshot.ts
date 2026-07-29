import { produce, type WritableDraft } from "immer";
import { external } from "@view/atom/external";
import type { PiOpenedSession, PiSessionRuntimeState } from "@shared/pi-contract";
import type { ChatSessionSnapshot } from "./types";

type Listener = () => void;

export class SessionSnapshot {
	private readonly listeners = new Set<Listener>();
	private data: ChatSessionSnapshot;
	private transactionDepth = 0;
	private transactionChanged = false;

	// React hooks
	public readonly useIsIdle: () => boolean;
	public readonly useOpenedSession: () => PiOpenedSession | null;

	public constructor(workspacePath: string, id: string, path: string) {
		this.data = {
			workspacePath,
			sessionId: id,
			sessionPath: path,
			phase: "idle",
			openedSession: null,
			isRefreshing: false,
			isSending: false,
			error: null,
			transient: {
				tail: { type: "empty" },
				queuedInputs: { steering: [], followUps: [] },
			},
		};

		const sub = external(this.subscribe);
		this.useIsIdle = sub(() => this.isIdle()).use;
		this.useOpenedSession = sub(() => this.data.openedSession).use;
	}

	public readonly get = (): ChatSessionSnapshot => this.data;

	public readonly subscribe = (listener: Listener): VoidFunction => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	public edit(recipe: (draft: WritableDraft<ChatSessionSnapshot>) => void): void {
		const data = produce(this.data, recipe);
		if (data === this.data) return;
		this.data = data;
		if (this.transactionDepth > 0) {
			this.transactionChanged = true;
			return;
		}
		this.notify();
	}

	public hydrate(openedSession: PiOpenedSession): void {
		this.edit((draft) => {
			draft.phase = "ready";
			draft.openedSession = openedSession;
			draft.isRefreshing = false;
			draft.error = null;
		});
	}

	public startLoading(): void {
		this.edit((draft) => {
			draft.phase = draft.openedSession ? "ready" : "loading";
			draft.isRefreshing = draft.openedSession !== null;
			draft.error = null;
		});
	}

	public failLoading(error: string): void {
		this.edit((draft) => {
			draft.phase = draft.openedSession ? "ready" : "failed";
			draft.isRefreshing = false;
			draft.error = error;
		});
	}

	public setRuntime(runtime: PiSessionRuntimeState): void {
		this.edit((draft) => {
			if (!draft.openedSession) throw new Error("Pi 会话尚未加载完成。");
			draft.openedSession.runtime = runtime;
		});
	}

	public setSending(isSending: boolean): void {
		this.edit((draft) => { draft.isSending = isSending; });
	}

  public setError(error: string | null): void {
		this.edit((draft) => { draft.error = error });
	}

	public transaction(operation: () => void): void {
		this.transactionDepth += 1;
		try {
			operation();
		} finally {
			this.transactionDepth -= 1;
			if (this.transactionDepth === 0 && this.transactionChanged) {
				this.transactionChanged = false;
				this.notify();
			}
		}
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}

  public canEvict() {
    const { tail, queuedInputs: { steering, followUps } } = this.data.transient;
    return tail.type === "empty" && steering.length === 0 && followUps.length === 0;
  }

  public isIdle() {
    const { transient: { tail, queuedInputs: { steering, followUps } }, openedSession, isSending } = this.data;
    if (isSending || tail.type !== "empty") return false;
    if (steering.length > 0 || followUps.length > 0) return false;
    return !(openedSession?.runtime.isStreaming);
  }

  public isStreaming() {
    return this.data.openedSession?.runtime.isStreaming ?? false;
  }
}
