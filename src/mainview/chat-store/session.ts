import type {
	PiOpenedSession,
	PiSessionEvent,
	PiQueuedSessionCommand,
	PiSessionRuntimeState,
	PiToolPermissionRequest,
	ThinkingLevel,
} from "@shared/pi-contract";
import {
	abortPiSession,
	compactPiSession,
	followUpPiSession,
	openPiSession,
	promptPiSession,
	regeneratePiSession,
	respondToPiToolPermission,
	setPiSessionModel,
	setPiSessionThinking,
	steerPiSession,
} from "@view/lib/pi-client";
import { SessionSnapshot } from "./snapshot";
import { SessionStream } from "./session-stream";
import { SessionView } from "./session-view";
import type {
	ChatPendingUserMessage,
	ChatQueuedUserInput,
	ChatQueuedInputs,
	ChatSessionActivity,
	ChatUserInput,
} from "./types";
import { assertOpenedSessionIdentity, requireValue, toErrorMessage } from "./utils";

export class ChatSession {
	public readonly view: SessionView;
	public readonly snapshot: SessionSnapshot;
	private readonly stream: SessionStream;
	private lastActiveAt: number;
	private consumerCount = 0;
	private commandCount = 0;
	private loadPromise: Promise<void> | undefined;
	private disposed = false;
	private regeneration: ReturnType<typeof Promise.withResolvers<void>> & { clientId: string } | undefined;

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
		this.snapshot = new SessionSnapshot(workspacePath, id, path);
		this.stream = new SessionStream(this.snapshot);
		this.view = new SessionView(this.snapshot);
	}

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
			consumerCount: this.consumerCount,
			isBusy: Boolean(this.loadPromise || this.commandCount > 0),
			isStreaming: this.snapshot.isStreaming(),
		};
	}

	public open(): Promise<void> {
		return this.load(false);
	}

	public reload(): Promise<void> {
		return this.load(true);
	}

	public async prompt(input: ChatUserInput): Promise<void> {
		const openedSession = this.requireOpenedSession();
		const images = input.attachments.map((attachment) => attachment.source);
		if (openedSession.runtime.isStreaming) {
			throw new Error("Pi 会话正在运行，请使用 steer 或 followUp。");
		}
		const requestRevision = this.stream.eventRevision;
		const pendingMessage = createPendingUserMessage(input.text, input);
		this.beginCommand();
		this.stream.beginPrompt(pendingMessage);
		try {
			const runtime = await promptPiSession({ sessionPath: this.path, text: input.text, images });
			if (!this.disposed && this.stream.eventRevision === requestRevision) {
				this.applyRuntime(runtime);
			}
		} catch (error) {
			if (!this.disposed) {
				this.snapshot.transaction(() => {
					if (this.stream.eventRevision === requestRevision) {
						this.stream.failPrompt();
					}
					this.snapshot.setError(toErrorMessage(error, "无法发送消息。"));
				});
			}
			throw error;
		} finally {
			this.endCommand();
		}
	}

	public async regenerate(entryId: string, input: ChatUserInput): Promise<void> {
		if (this.regeneration) throw new Error("已有历史消息正在重新生成。");
		const images = input.attachments.map((attachment) => attachment.source);
		const clientId = Math.random().toString(36).slice(2, 10);
		this.regeneration = { clientId, ...Promise.withResolvers<void>() };
		this.beginCommand();
		this.snapshot.setError(null);
		try {
			regeneratePiSession({ clientId, entryId, sessionPath: this.path, text: input.text, images })
				.catch(this.regeneration.reject);
			await this.regeneration.promise;
		} catch (error) {
			if (!this.disposed) {
				this.snapshot.setError(toErrorMessage(error, "无法重新生成历史消息。"));
			}
			throw error;
		} finally {
			this.regeneration = undefined;
			this.endCommand();
		}
	}

	public async steer(input: ChatUserInput): Promise<void> {
		await this.runStreamingCommand(input, "steering", "无法追加当前指令。", steerPiSession);
	}

	public async followUp(input: ChatUserInput): Promise<void> {
		await this.runStreamingCommand(input, "followUps", "无法排队后续消息。", followUpPiSession);
	}

	public async abort(): Promise<void> {
		this.requireOpenedSession();
		const requestRevision = this.stream.eventRevision;
		this.beginCommand();
		this.snapshot.setError(null);
		try {
			const runtime = await abortPiSession({ sessionPath: this.path });
			if (!this.disposed) {
				if (this.stream.eventRevision === requestRevision) this.applyRuntime(runtime);
				this.stream.finishAbort();
			}
		} catch (error) {
			this.snapshot.setError(toErrorMessage(error, "无法停止 Pi 会话。"));
			throw error;
		} finally {
			this.endCommand();
		}
	}

	public async compact(): Promise<void> {
		this.requireOpenedSession();
		this.beginCommand();
		this.snapshot.setError(null);
		try {
			const runtime = await compactPiSession({ sessionPath: this.path });
			if (!this.disposed) this.applyRuntime(runtime);
		} catch (error) {
			this.snapshot.setError(toErrorMessage(error, "无法压缩 Pi 会话。"));
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

	public async respondToPermission(request: PiToolPermissionRequest, allowed: boolean): Promise<void> {
		this.touch();
		try {
			await respondToPiToolPermission({ id: request.id, allowed });
			if (!this.disposed) this.stream.resolvePermission(request, allowed);
		} catch (error) {
			this.snapshot.setError(toErrorMessage(error, "无法提交工具授权决定。"));
			throw error;
		}
	}

	public acceptEvent(event: PiSessionEvent): void {
		if (this.disposed || event.sessionPath !== this.path) return;
		if (!this.snapshot.get().openedSession) {
			this.stream.enqueue({ kind: "event", value: event });
			this.touch();
			return;
		}
		this.touch();
		this.stream.acceptEvent(event);
		const task = this.regeneration;
		if (task) {
			switch (event.type) {
				case "regeneration_failed":
					event.clientId === task.clientId && task.reject(new Error(event.errorMessage));
					break;
				case "transcript_entries_appended":
				case "transcript_rebased":
					event.confirmedInputs.some((i) => i.clientId === task.clientId) && task.resolve();
					break;
			}
		}
	}

	public acceptPermission(request: PiToolPermissionRequest): void {
		if (this.disposed || request.sessionPath !== this.path) return;
		if (!this.snapshot.get().openedSession) {
			this.stream.enqueue({ kind: "permission", value: request });
			this.touch();
			return;
		}
		this.touch();
		this.stream.acceptPermission(request);
	}

	public canEvict(now: number, inactivityTimeoutMs: number): boolean {
		if (this.disposed) return true;
		const activity = this.activity;
		return activity.consumerCount === 0
			&& !activity.isBusy
			&& !activity.isStreaming
			&& this.snapshot.canEvict()
			&& now - activity.lastActiveAt >= inactivityTimeoutMs;
	}

	public hydrate(openedSession: PiOpenedSession): void {
		if (this.disposed) return;
		assertOpenedSessionIdentity(openedSession, this.workspacePath, this.id, this.path);
		this.touch();
		this.snapshot.hydrate(openedSession);
		for (const input of this.stream.takePendingInputs()) {
			if (input.kind === "event") this.acceptEvent(input.value);
			else this.acceptPermission(input.value);
		}
	}

	public dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.stream.dispose();
		this.view.dispose();
		this.regeneration?.reject(new Error("该会话已从 Chat Store 中释放。"));
	}

	private load(force: boolean): Promise<void> {
		this.assertUsable();
		this.touch();
		if (!force && this.snapshot.get().phase === "ready") return Promise.resolve();
		if (this.loadPromise) return this.loadPromise;
		this.snapshot.startLoading();
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
			this.snapshot.failLoading(toErrorMessage(error, "无法打开 Pi 会话。"));
			throw error;
		}
	}


	private async runStreamingCommand(
		input: ChatUserInput,
		queue: keyof ChatQueuedInputs,
		fallbackError: string,
		request: (input: PiQueuedSessionCommand) => Promise<PiSessionRuntimeState>,
	): Promise<void> {
		const openedSession = this.requireOpenedSession();
		if (!openedSession.runtime.isStreaming) throw new Error("Pi 会话当前没有运行中的任务。");
		const images = input.attachments.map((attachment) => attachment.source);
		const clientId = Math.random().toString(36).slice(2, 10);
		const queuedInput: ChatQueuedUserInput = {
			state: "submitting",
			message: createPendingUserMessage(input.text, input, clientId),
		};
		const requestRevision = this.stream.eventRevision;
		this.beginCommand();
		this.stream.beginQueuedInput(queue, queuedInput);
		try {
			const runtime = await request({ clientId, sessionPath: this.path, text: input.text, images });
			if (!this.disposed) {
				this.stream.acceptQueuedInput(queuedInput.message.clientId);
				if (this.stream.eventRevision === requestRevision) this.applyRuntime(runtime);
			}
		} catch (error) {
			if (!this.disposed) {
				this.snapshot.transaction(() => {
					this.stream.failQueuedInput(queuedInput.message.clientId);
					this.snapshot.setError(toErrorMessage(error, fallbackError));
				});
			}
			throw error;
		} finally {
			this.endCommand();
		}
	}

	private async runOpenedSessionMutation(
		request: () => Promise<PiSessionRuntimeState>,
		fallbackError: string,
	): Promise<void> {
		const openedSession = this.requireOpenedSession();
		if (openedSession.runtime.isStreaming) throw new Error("Pi 会话运行期间不能修改此设置。");
		this.beginCommand();
		this.snapshot.setError(null);
		try {
			const runtime = await request();
			if (!this.disposed) this.applyRuntime(runtime);
		} catch (error) {
			this.snapshot.setError(toErrorMessage(error, fallbackError));
			throw error;
		} finally {
			this.endCommand();
		}
	}

	private applyRuntime(runtime: PiSessionRuntimeState): void {
		if (runtime.sessionId !== this.id || runtime.sessionPath !== this.path) {
			throw new Error(`主进程返回了错误的会话：${runtime.sessionId}`);
		}
		this.requireOpenedSession();
		this.snapshot.setRuntime(runtime);
	}

	private beginCommand(): void {
		this.assertUsable();
		this.touch();
		this.commandCount += 1;
		if (this.commandCount === 1) this.snapshot.setSending(true);
	}

	private endCommand(): void {
		this.commandCount = Math.max(0, this.commandCount - 1);
		if (this.commandCount === 0) this.snapshot.setSending(false);
	}

	private requireOpenedSession(): PiOpenedSession {
		this.assertUsable();
		const openedSession = this.snapshot.get().openedSession;
		if (!openedSession) throw new Error("Pi 会话尚未加载完成。");
		return openedSession;
	}

	private assertUsable(): void {
		if (this.disposed) throw new Error("该会话已从 Chat Store 中释放。");
	}

	private touch(): void {
		if (!this.disposed) this.lastActiveAt = this.now();
	}
}

function createPendingUserMessage(
	text: string,
	input: ChatUserInput,
	clientId = Math.random().toString(36).slice(2, 10),
): ChatPendingUserMessage {
	return {
		clientId,
		text,
		images: input.attachments.map((attachment) => ({
			id: attachment.id,
			alt: attachment.name,
			src: attachment.previewDataUrl,
		})),
	};
}
