import type {
	PiImageAttachmentSource,
	PiOpenedSession,
	PiSessionEvent,
	PiSessionRuntimeState,
	PiToolPermissionRequest,
	ThinkingLevel,
} from "@shared/pi-contract";
import {
	abortPiSession,
	followUpPiSession,
	openPiSession,
	promptPiSession,
	readPiSessionTranscript,
	respondToPiToolPermission,
	setPiSessionModel,
	setPiSessionThinking,
	steerPiSession,
} from "@view/lib/pi-client";
import { SessionStream } from "./session-stream";
import { SessionView } from "./session-view";
import type { ChatSessionActivity, ChatSessionSnapshot } from "./types";
import {
	assertOpenedSessionIdentity,
	normalizePromptInput,
	requireValue,
	toErrorMessage,
} from "./utils";

type Listener = () => void;
type SessionPatch = Partial<
	Omit<ChatSessionSnapshot, "workspacePath" | "sessionId" | "sessionPath">
>;

export class ChatSession {
	public readonly view: SessionView;
	private readonly stream = new SessionStream();
	private readonly listeners = new Set<Listener>();
	private snapshot: ChatSessionSnapshot;
	private lastActiveAt: number;
	private consumerCount = 0;
	private commandCount = 0;
	private loadPromise: Promise<void> | undefined;
	private refreshPromise: Promise<void> | undefined;
	private refreshRequested = false;
	private disposed = false;

	public constructor(
		public readonly workspacePath: string,
		public readonly id: string,
		public readonly path: string,
		private readonly now: () => number,
	) {
		requireValue(workspacePath, "workspacePath");
		requireValue(id, "sessionId");
		requireValue(path, "sessionPath");
		this.lastActiveAt = now();
		this.snapshot = {
			workspacePath,
			sessionId: id,
			sessionPath: path,
			phase: "idle",
			openedSession: null,
			isRefreshing: false,
			isSending: false,
			error: null,
			pendingUserMessage: null,
			streamedText: "",
			thinkingText: "",
			tools: [],
			permissionRequests: [],
		};
		this.view = new SessionView(this);
	}

	public readonly getSnapshot = (): ChatSessionSnapshot => {
		this.touch();
		return this.snapshot;
	};

	public readonly subscribe = (listener: Listener): (() => void) => {
		this.assertUsable();
		this.touch();
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
			this.touch();
		};
	};

	public acquire(): () => void {
		this.assertUsable();
		this.consumerCount += 1;
		this.touch();
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.consumerCount -= 1;
			this.touch();
		};
	}

	public get activity(): ChatSessionActivity {
		return {
			lastActiveAt: this.lastActiveAt,
			consumerCount: this.consumerCount + this.listeners.size,
			isBusy: Boolean(this.loadPromise || this.refreshPromise || this.commandCount > 0),
			isStreaming: this.snapshot.openedSession?.runtime.isStreaming ?? false,
		};
	}

	public get isHydrated(): boolean {
		return this.snapshot.openedSession !== null;
	}

	public open(): Promise<void> {
		return this.load(false);
	}

	public reload(): Promise<void> {
		return this.load(true);
	}

	public refreshTranscript(): Promise<void> {
		this.requireOpenedSession();
		this.touch();
		this.refreshRequested = true;
		if (this.refreshPromise) return this.refreshPromise;
		this.refreshPromise = this.runRefreshQueue().finally(() => {
			this.refreshPromise = undefined;
		});
		return this.refreshPromise;
	}

	public async prompt(text: string, images: readonly PiImageAttachmentSource[] = []): Promise<void> {
		const openedSession = this.requireOpenedSession();
		const input = normalizePromptInput(text, images);
		if (openedSession.runtime.isStreaming) {
			throw new Error("Pi 会话正在运行，请使用 steer 或 followUp。");
		}
		const requestRevision = this.stream.eventRevision;
		this.beginCommand();
		this.publish(this.stream.beginPrompt(
			openedSession,
			input.text || `[已附加 ${input.images.length} 张图片]`,
		));
		try {
			const runtime = await promptPiSession({ sessionPath: this.path, ...input });
			if (!this.disposed && this.stream.eventRevision === requestRevision) {
				this.applyRuntime(runtime);
			}
		} catch (error) {
			if (!this.disposed) {
				const patch: SessionPatch = { error: toErrorMessage(error, "无法发送消息。") };
				if (this.stream.eventRevision === requestRevision) {
					Object.assign(patch, this.stream.failPrompt(this.requireOpenedSession()));
				}
				this.publish(patch);
			}
			throw error;
		} finally {
			this.endCommand();
		}
	}

	public async steer(text: string, images: readonly PiImageAttachmentSource[] = []): Promise<void> {
		await this.runStreamingCommand(text, images, "无法追加当前指令。", steerPiSession);
	}

	public async followUp(text: string, images: readonly PiImageAttachmentSource[] = []): Promise<void> {
		await this.runStreamingCommand(text, images, "无法排队后续消息。", followUpPiSession);
	}

	public async abort(): Promise<void> {
		this.requireOpenedSession();
		const requestRevision = this.stream.eventRevision;
		this.beginCommand();
		this.publish({ error: null });
		try {
			const runtime = await abortPiSession({ sessionPath: this.path });
			if (!this.disposed && this.stream.eventRevision === requestRevision) {
				this.applyRuntime(runtime);
			}
		} catch (error) {
			if (!this.disposed) this.publish({ error: toErrorMessage(error, "无法停止 Pi 会话。") });
			throw error;
		} finally {
			this.endCommand();
		}
	}

	public async setModel(provider: string, modelId: string): Promise<void> {
		await this.runOpenedSessionMutation(
			() => setPiSessionModel({ sessionPath: this.path, provider, modelId }),
			"无法切换 Pi 模型。",
		);
	}

	public async setThinking(thinkingLevel: ThinkingLevel): Promise<void> {
		await this.runOpenedSessionMutation(
			() => setPiSessionThinking({ sessionPath: this.path, thinkingLevel }),
			"无法切换思考等级。",
		);
	}

	public async respondToPermission(requestId: string, allowed: boolean): Promise<void> {
		const request = this.snapshot.permissionRequests.find((candidate) => candidate.id === requestId);
		if (!request) throw new Error("该工具授权请求不属于当前会话或已失效。");
		this.touch();
		try {
			await respondToPiToolPermission({ id: requestId, allowed });
			if (!this.disposed) this.publish(this.stream.resolvePermission(request, allowed));
		} catch (error) {
			if (!this.disposed) {
				this.publish({ error: toErrorMessage(error, "无法提交工具授权决定。") });
			}
			throw error;
		}
	}

	public acceptEvent(event: PiSessionEvent): void {
		if (this.disposed || event.sessionPath !== this.path) return;
		const openedSession = this.snapshot.openedSession;
		if (!openedSession) {
			this.stream.enqueue({ kind: "event", value: event });
			this.touch();
			return;
		}
		this.touch();
		const transition = this.stream.acceptEvent(event, openedSession);
		if (transition.patch) this.publish(transition.patch);
		if (transition.refreshTranscript) {
			void this.refreshTranscript().catch(() => undefined);
		}
	}

	public acceptPermission(request: PiToolPermissionRequest): void {
		if (this.disposed || request.sessionPath !== this.path) return;
		if (!this.isHydrated) {
			this.stream.enqueue({ kind: "permission", value: request });
			this.touch();
			return;
		}
		this.touch();
		const patch = this.stream.acceptPermission(request);
		if (patch) this.publish(patch);
	}

	public canEvict(now: number, inactivityTimeoutMs: number): boolean {
		if (this.disposed) return true;
		const activity = this.activity;
		return activity.consumerCount === 0
			&& !activity.isBusy
			&& !activity.isStreaming
			&& this.snapshot.permissionRequests.length === 0
			&& now - activity.lastActiveAt >= inactivityTimeoutMs;
	}

	public hydrate(openedSession: PiOpenedSession): void {
		if (this.disposed) return;
		assertOpenedSessionIdentity(openedSession, this.workspacePath, this.id, this.path);
		this.touch();
		this.publish({
			phase: "ready",
			openedSession,
			isRefreshing: false,
			error: null,
		});
		for (const input of this.stream.takePendingInputs()) {
			if (input.kind === "event") this.acceptEvent(input.value);
			else this.acceptPermission(input.value);
		}
	}

	public dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.listeners.clear();
		this.stream.dispose();
		this.view.dispose();
	}

	private load(force: boolean): Promise<void> {
		this.assertUsable();
		this.touch();
		if (!force && this.snapshot.phase === "ready") return Promise.resolve();
		if (this.loadPromise) return this.loadPromise;
		this.publish({
			phase: this.snapshot.openedSession ? "ready" : "loading",
			isRefreshing: this.snapshot.openedSession !== null,
			error: null,
		});
		this.loadPromise = this.loadOpenedSession().finally(() => {
			this.loadPromise = undefined;
		});
		return this.loadPromise;
	}

	private async loadOpenedSession(): Promise<void> {
		try {
			const openedSession = await openPiSession({
				workspacePath: this.workspacePath,
				sessionPath: this.path,
			});
			if (!this.disposed) this.hydrate(openedSession);
		} catch (error) {
			if (!this.disposed) {
				this.publish({
					phase: this.snapshot.openedSession ? "ready" : "failed",
					isRefreshing: false,
					error: toErrorMessage(error, "无法打开 Pi 会话。"),
				});
			}
			throw error;
		}
	}

	private async runRefreshQueue(): Promise<void> {
		if (!this.snapshot.isRefreshing) this.publish({ isRefreshing: true });
		try {
			while (this.refreshRequested && !this.disposed) {
				this.refreshRequested = false;
				const requestGeneration = this.stream.streamGeneration;
				const transcript = await readPiSessionTranscript({
					workspacePath: this.workspacePath,
					sessionPath: this.path,
				});
				if (this.disposed) return;
				const openedSession = this.requireOpenedSession();
				const settlePatch = this.stream.completeRefresh(requestGeneration);
				this.publish({
					openedSession: {
						...openedSession,
						runtime: settlePatch
							? { ...openedSession.runtime, isStreaming: false }
							: openedSession.runtime,
						transcript,
					},
					...settlePatch,
				});
			}
		} catch (error) {
			if (!this.disposed) {
				this.publish({ error: toErrorMessage(error, "无法刷新 Pi 会话。") });
			}
			throw error;
		} finally {
			if (!this.disposed) this.publish({ isRefreshing: false });
		}
	}

	private async runStreamingCommand(
		text: string,
		images: readonly PiImageAttachmentSource[],
		fallbackError: string,
		request: (input: { sessionPath: string; text: string; images?: PiImageAttachmentSource[] }) => Promise<PiSessionRuntimeState>,
	): Promise<void> {
		const openedSession = this.requireOpenedSession();
		if (!openedSession.runtime.isStreaming) throw new Error("Pi 会话当前没有运行中的任务。");
		const input = normalizePromptInput(text, images);
		const requestRevision = this.stream.eventRevision;
		this.beginCommand();
		this.publish({ error: null });
		try {
			const runtime = await request({ sessionPath: this.path, ...input });
			if (!this.disposed && this.stream.eventRevision === requestRevision) {
				this.applyRuntime(runtime);
			}
		} catch (error) {
			if (!this.disposed) this.publish({ error: toErrorMessage(error, fallbackError) });
			throw error;
		} finally {
			this.endCommand();
		}
	}

	private async runOpenedSessionMutation(
		request: () => Promise<PiOpenedSession>,
		fallbackError: string,
	): Promise<void> {
		const openedSession = this.requireOpenedSession();
		if (openedSession.runtime.isStreaming) throw new Error("Pi 会话运行期间不能修改此设置。");
		this.beginCommand();
		this.publish({ error: null });
		try {
			const nextSession = await request();
			if (!this.disposed) this.hydrate(nextSession);
		} catch (error) {
			if (!this.disposed) this.publish({ error: toErrorMessage(error, fallbackError) });
			throw error;
		} finally {
			this.endCommand();
		}
	}

	private applyRuntime(runtime: PiSessionRuntimeState): void {
		if (runtime.sessionId !== this.id || runtime.sessionPath !== this.path) {
			throw new Error(`主进程返回了错误的会话：${runtime.sessionId}`);
		}
		const openedSession = this.requireOpenedSession();
		this.publish({ openedSession: { ...openedSession, runtime } });
	}

	private beginCommand(): void {
		this.assertUsable();
		this.touch();
		this.commandCount += 1;
		if (this.commandCount === 1) this.publish({ isSending: true });
	}

	private endCommand(): void {
		this.commandCount = Math.max(0, this.commandCount - 1);
		if (!this.disposed && this.commandCount === 0) this.publish({ isSending: false });
	}

	private requireOpenedSession(): PiOpenedSession {
		this.assertUsable();
		const openedSession = this.snapshot.openedSession;
		if (!openedSession) throw new Error("Pi 会话尚未加载完成。");
		return openedSession;
	}

	private assertUsable(): void {
		if (this.disposed) throw new Error("该会话已从 Chat Store 中释放。");
	}

	private touch(): void {
		if (!this.disposed) this.lastActiveAt = this.now();
	}

	private publish(patch: SessionPatch): void {
		if (this.disposed) return;
		this.snapshot = { ...this.snapshot, ...patch };
		for (const listener of this.listeners) listener();
	}
}
