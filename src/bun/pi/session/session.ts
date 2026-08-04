import { existsSync } from "node:fs";
import {
	createAgentSessionFromServices,
	createAgentSessionServices,
	type AgentSession,
	type AgentSessionEvent,
	type AgentSessionServices,
	type ModelRuntime,
	SessionManager,
	type SessionInfo,
	type SessionTreeNode,
} from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { ImageContent } from "@earendil-works/pi-ai";
import type {
	PiImageAttachmentSource,
	PiOpenedSession,
	PiSessionRuntimeState,
	PiSessionTranscriptUpdate,
} from "@shared/pi-contract";
import { PiError, toError } from "../errors";
import { createSessionExtensionFactories, type PiSessionHooks } from "./hooks";
import { loadPiImageAttachments } from "./image-attachments";
import { QueuedInputTracker } from "./queued-input-tracker";
import {
	createPiOpenedSession,
	createPiSessionRuntimeState,
	getFirstUserMessageText,
	isPiSessionTranscriptEntry,
	toPiSessionTranscriptEntries,
} from "./snapshot";

export type PiSessionEvent =
	| AgentSessionEvent
	| ({ type: "transcript_entries_appended" } & PiSessionTranscriptUpdate)
	| ({ type: "transcript_rebased"; replaceFrom: number } & PiSessionTranscriptUpdate)
	| { type: "regeneration_failed"; clientId: string; error: Error }
	| { type: "error"; error: Error }
	| { type: "queued_inputs_cleared"; clientIds: string[] };


type CreatePiSessionOptions = {
	agentDir: string;
	hooks: PiSessionHooks;
	modelRuntime: ModelRuntime;
	sessionInfo?: SessionInfo;
	sessionManager: SessionManager;
	workspacePath: string;
};

export class PiSession {
	private agentSession: AgentSession | undefined;
	private disposed = false;
	private readonly listeners = new Set<(event: PiSessionEvent) => void>();
	private services: AgentSessionServices | undefined;
	private sessionPath: string | undefined;
	private unsubscribeAgent: (() => void) | undefined;
	private publishedTranscriptIds: string[] = [];
	private transcriptPublishScheduled = false;
	private readonly queuedInputs = new QueuedInputTracker();

	private constructor(private readonly options: CreatePiSessionOptions) {}

	static async create(options: CreatePiSessionOptions): Promise<PiSession> {
		const session = new PiSession(options);
		await session.createRuntime(options.sessionManager);
		return session;
	}

	get path(): string {
		if (!this.sessionPath) throw new PiError("session-not-persisted", "Pi 未创建持久化会话文件。");
		return this.sessionPath;
	}

	get workspacePath(): string {
		return this.options.workspacePath;
	}

	get provider(): string | null {
		return this.requireAgentSession().model?.provider ?? null;
	}

	get isIdle(): boolean {
		return this.requireAgentSession().isIdle;
	}

	getSnapshot(): PiOpenedSession {
		return createPiOpenedSession({
			baseInfo: this.options.sessionInfo,
			path: this.path,
			services: this.requireServices(),
			session: this.requireAgentSession(),
			workspacePath: this.workspacePath,
		});
	}

	getRuntimeState(): PiSessionRuntimeState {
		return createPiSessionRuntimeState(
			this.requireAgentSession(),
			this.requireServices(),
			this.path,
		);
	}

	async setModel(provider: string, modelId: string): Promise<void> {
		const model = this.requireServices().modelRuntime.getModel(provider, modelId);
		if (!model) throw new Error("所选模型不在当前 Pi 配置中。");
		await this.requireAgentSession().setModel(model);
	}

	setThinking(level: ThinkingLevel): void {
		this.requireAgentSession().setThinkingLevel(level);
	}

	setName(name: string): void {
		this.requireAgentSession().setSessionName(name);
	}

	async prompt(text: string, imageSources: readonly PiImageAttachmentSource[] = []): Promise<void> {
		const session = this.requireAgentSession();
		const images = await this.prepareImages(imageSources);
		await submitSessionPrompt(session, text, images, (error) => {
			this.emit({ type: "error", error });
		}).accepted;
	}

	private regenerationId?: string | undefined;
	async regenerate(
		clientId: string,
		entryId: string,
		text: string,
		imageSources: readonly PiImageAttachmentSource[] = [],
	): Promise<void> {
		const session = this.requireAgentSession();
		const previousLeafId = session.sessionManager.getLeafId();
		if (!previousLeafId) {
			throw new Error("Pi 会话没有可恢复的活动分支，无法重新生成历史消息。");
		}
		const images = await this.prepareImages(imageSources);
		await navigateToUserMessageForRegeneration(session, entryId);
		this.regenerationId = clientId;
		const submission = submitSessionPrompt(session, text, images, (error) => {
			this.emit({ type: "error", error });
		});
		try {
			await submission.accepted;
		} catch (error) {
			this.regenerationId = undefined;
			await session.navigateTree(previousLeafId, { summarize: false });
			throw error;
		}
		submission.completion.then(async (error) => {
			if (!this.regenerationId) return;
			this.regenerationId = undefined;
			const restoration = await session.navigateTree(previousLeafId, { summarize: false }).catch((restoreError) => {
				error = toError(restoreError, "重新生成失败，且无法恢复原分支。");
			});
			this.publishTranscriptChanges(session);
			if (restoration?.cancelled) error = new Error("Pi 扩展取消了原分支恢复。");
			else error ??= new Error("Pi 扩展处理了输入，但没有生成用户消息。");
			this.emit({ type: "regeneration_failed", clientId, error });
		});
	}

	async steer(
		clientId: string,
		text: string,
		imageSources: readonly PiImageAttachmentSource[] = [],
	): Promise<void> {
		const session = this.requireAgentSession();
		const images = await this.prepareImages(imageSources);
		await this.queuedInputs.enqueue("steering", clientId, () => session.steer(text, images), images);
	}

	async followUp(
		clientId: string,
		text: string,
		imageSources: readonly PiImageAttachmentSource[] = [],
	): Promise<void> {
		const session = this.requireAgentSession();
		const images = await this.prepareImages(imageSources);
		await this.queuedInputs.enqueue("followUp", clientId, () => session.followUp(text, images), images);
	}

	async abort(): Promise<void> {
		const session = this.requireAgentSession();
		this.clearQueuedInputs(session);
		await session.abort();
	}

	createClonedSessionManager(): SessionManager {
		const session = this.requireAgentSession();
		const leafId = session.sessionManager.getLeafId();
		if (!leafId) throw new Error("Pi 会话还没有消息，无法复制。");
		if (!existsSync(this.path)) {
			throw new Error("当前 Pi 会话尚未保存。请等待首条回复完成后再复制。");
		}
		const manager = SessionManager.open(this.path);
		if (!manager.createBranchedSession(leafId)) {
			throw new Error("Pi 未能创建会话副本。");
		}
		return manager;
	}

	async compact(): Promise<void> {
		const session = this.requireAgentSession();
		this.clearQueuedInputs(session);
		await session.compact();
		this.publishTranscriptChanges(session);
	}

	async requireResolvedAuthentication(): Promise<void> {
		const session = this.requireAgentSession();
		const model = session.model;
		if (!model || !(await this.requireServices().modelRuntime.getAuth(model))) {
			throw new PiError("authentication-resolution-failed", "Pi 无法解析当前模型的认证信息。");
		}
	}

	async prepareAuthenticationRetry(): Promise<void> {
		const session = this.requireAgentSession();
		const failed = session.sessionManager.getEntry(session.sessionManager.getLeafId() ?? "");
		if (failed?.type !== "message" || failed.message.role !== "assistant" || !failed.parentId) {
			throw new Error("Pi 无法恢复 OAuth 失败前的用户消息；请重新发送。");
		}
		await session.navigateTree(failed.parentId, { summarize: false });
		this.publishTranscriptChanges(session);
	}

	async continue(): Promise<void> {
		await this.requireAgentSession().agent.continue();
	}

	async rebuild(): Promise<void> {
		const path = this.path;
		const selectedEntryId = this.requireAgentSession().sessionManager.getLeafId();
		await this.disposeRuntime();
		await this.createRuntime(SessionManager.open(path));
		if (selectedEntryId && hasTreeEntry(this.requireAgentSession().sessionManager.getTree(), selectedEntryId)) {
			await this.requireAgentSession().navigateTree(selectedEntryId, { summarize: false });
		}
		this.syncPublishedTranscript(this.requireAgentSession());
	}

	subscribe(listener: (event: PiSessionEvent) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async dispose(): Promise<void> {
		if (this.disposed) return;
		this.disposed = true;
		await this.disposeRuntime();
		this.listeners.clear();
	}

	private async createRuntime(sessionManager: SessionManager): Promise<void> {
		const services = await createAgentSessionServices({
			agentDir: this.options.agentDir,
			cwd: this.options.workspacePath,
			modelRuntime: this.options.modelRuntime,
			resourceLoaderOptions: {
				extensionFactories: createSessionExtensionFactories(this.options.hooks, () => this.sessionPath),
			},
		});
		const { session } = await createAgentSessionFromServices({ services, sessionManager });
		this.services = services;
		this.agentSession = session;
		this.sessionPath = requireSessionPath(session);
		await session.bindExtensions({});
		this.syncPublishedTranscript(session);
		this.unsubscribeAgent = session.subscribe((event) => this.handleAgentEvent(session, event));
		this.queuedInputs.reset(session.getSteeringMessages(), session.getFollowUpMessages());
	}

	private clearQueuedInputs(session: AgentSession): void {
		const clientIds = this.queuedInputs.clear(() => session.clearQueue());
		if (clientIds.length > 0) {
			this.emit({ type: "queued_inputs_cleared", clientIds });
		}
	}

	private async disposeRuntime(): Promise<void> {
		const session = this.agentSession;
		if (!session) return;
		this.unsubscribeAgent?.();
		this.unsubscribeAgent = undefined;
		this.agentSession = undefined;
		this.services = undefined;
		await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
		session.dispose();
		this.queuedInputs.reset([], []);
	}

	private async prepareImages(
		imageSources: readonly PiImageAttachmentSource[],
	): Promise<ImageContent[] | undefined> {
		if (imageSources.length === 0) return undefined;
		const model = this.requireAgentSession().model;
		if (!model?.input.includes("image")) {
			throw new Error("当前模型不支持图片输入。");
		}
		return loadPiImageAttachments(imageSources);
	}

	private handleAgentEvent(session: AgentSession, event: AgentSessionEvent): void {
		const clientIds = this.queuedInputs.acceptAgentEvent(event);
		if (clientIds.length > 0) {
			this.emit({ type: "queued_inputs_cleared", clientIds });
		}
		this.emit(event);
		if (
			(event.type === "message_end" && event.message.role === "user")
			|| event.type === "agent_settled"
		) {
			this.scheduleTranscriptPublish(session);
		}
	}

	private scheduleTranscriptPublish(session: AgentSession): void {
		if (this.transcriptPublishScheduled) return;
		this.transcriptPublishScheduled = true;
		queueMicrotask(() => {
			this.transcriptPublishScheduled = false;
			if (this.disposed || this.agentSession !== session) return;
			this.publishTranscriptChanges(session);
		});
	}

	private publishTranscriptChanges(session: AgentSession): void {
		const allEntries = session.sessionManager.getEntries();
		const contextEntries = session.sessionManager.buildContextEntries()
			.filter(isPiSessionTranscriptEntry);
		const nextIds = contextEntries.map((entry) => entry.id);
		const replaceFrom = commonPrefixLength(this.publishedTranscriptIds, nextIds);
		if (
			replaceFrom === this.publishedTranscriptIds.length
			&& replaceFrom === nextIds.length
		) return;
		const lastEntry = allEntries[allEntries.length - 1];
		const changedEntries = contextEntries.slice(replaceFrom);
		const confirmedInputs = this.queuedInputs.confirmPersistedEntries(changedEntries);
		if (this.regenerationId) {
			for (let index = changedEntries.length - 1; index >= 0; index -= 1) {
				const entry = changedEntries[index];
				if (entry.type === "message" && entry.message.role === "user") {
					confirmedInputs.push({ clientId: this.regenerationId, entryId: entry.id });
					this.regenerationId = undefined;
					break;
				}
			}
		}
		const update = {
			entries: toPiSessionTranscriptEntries(changedEntries),
			confirmedInputs,
			firstMessage: getFirstUserMessageText(allEntries),
			messageCount: allEntries.length,
			modifiedAt: lastEntry?.timestamp ?? new Date().toISOString(),
		};
		const appendOnly = replaceFrom === this.publishedTranscriptIds.length;
		this.publishedTranscriptIds = nextIds;
		this.emit(appendOnly
			? { type: "transcript_entries_appended", ...update }
			: { type: "transcript_rebased", replaceFrom, ...update });
	}

	private syncPublishedTranscript(session: AgentSession): void {
		this.publishedTranscriptIds = session.sessionManager.buildContextEntries()
			.filter(isPiSessionTranscriptEntry)
			.map((entry) => entry.id);
	}

	private emit(event: PiSessionEvent): void {
		for (const listener of this.listeners) listener(event);
	}

	private requireAgentSession(): AgentSession {
		if (!this.agentSession) throw new PiError("session-closed", "Pi 会话已经关闭。");
		return this.agentSession;
	}

	private requireServices(): AgentSessionServices {
		if (!this.services) throw new PiError("session-closed", "Pi 会话已经关闭。");
		return this.services;
	}
}

export async function navigateToUserMessageForRegeneration(
	session: Pick<AgentSession, "navigateTree" | "sessionManager">,
	entryId: string,
): Promise<void> {
	const entry = session.sessionManager.getEntry(entryId);
	if (entry?.type !== "message" || entry.message.role !== "user") {
		throw new Error("要重新生成的消息不是该会话中的用户消息。");
	}
	if (session.sessionManager.getLeafId() === entryId) {
		throw new Error("该用户消息尚无后续回复，无法重新生成。");
	}
	const result = await session.navigateTree(entryId, { summarize: false });
	if (result.cancelled) throw new Error("Pi 扩展取消了历史消息编辑。");
}

export function submitSessionPrompt(
	session: Pick<AgentSession, "prompt">,
	text: string,
	images: ImageContent[] | undefined,
	onError: (error: Error) => void,
) {
	const { promise: accepted, reject, resolve } = Promise.withResolvers<void>();
	const completion = session.prompt(text, {
		images,
		preflightResult: (success) => {
			if (success) resolve();
			else reject(new Error("Pi 未接受这条消息。"));
		},
	}).catch((error: unknown) => {
		const promptError = toError(error, "Pi 会话运行失败。");
		onError(promptError);
		reject(promptError);
		return promptError;
	});
	return { accepted, completion };
}

function commonPrefixLength(left: readonly string[], right: readonly string[]): number {
	const limit = Math.min(left.length, right.length);
	let index = 0;
	while (index < limit && left[index] === right[index]) index += 1;
	return index;
}

function requireSessionPath(session: AgentSession): string {
	if (!session.sessionFile) throw new PiError("session-not-persisted", "Pi 未创建持久化会话文件。");
	return session.sessionFile;
}

function hasTreeEntry(nodes: SessionTreeNode[], entryId: string): boolean {
	return nodes.some((node) => node.entry.id === entryId || hasTreeEntry(node.children, entryId));
}
