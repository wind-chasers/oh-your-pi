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
import type { PiOpenedSession } from "@shared/pi-contract";
import { PiError, toError } from "../errors";
import { createSessionExtensionFactories, type PiSessionHooks } from "./hooks";
import { createPiOpenedSession } from "./snapshot";

export type PiSessionEvent = AgentSessionEvent | { type: "error"; error: Error };

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

	async setModel(provider: string, modelId: string): Promise<void> {
		const model = this.requireServices().modelRuntime.getModel(provider, modelId);
		if (!model) throw new Error("所选模型不在当前 Pi 配置中。");
		await this.requireAgentSession().setModel(model);
	}

	setThinking(level: ThinkingLevel): void {
		this.requireAgentSession().setThinkingLevel(level);
	}

	async prompt(text: string): Promise<void> {
		await submitSessionPrompt(this.requireAgentSession(), text, (error) => {
			this.emit({ type: "error", error });
		});
	}

	async steer(text: string): Promise<void> {
		await this.requireAgentSession().steer(text);
	}

	async followUp(text: string): Promise<void> {
		await this.requireAgentSession().followUp(text);
	}

	async abort(): Promise<void> {
		await this.requireAgentSession().abort();
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
		this.unsubscribeAgent = session.subscribe((event) => this.emit(event));
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

export async function submitSessionPrompt(
	session: Pick<AgentSession, "prompt">,
	text: string,
	onError: (error: Error) => void,
): Promise<void> {
	const { promise: accepted, reject, resolve } = Promise.withResolvers<void>();
	void session.prompt(text, {
		preflightResult: (success) => {
			if (success) resolve();
			else reject(new Error("Pi 未接受这条消息。"));
		},
	}).catch((error: unknown) => {
		const promptError = toError(error, "Pi 会话运行失败。");
		onError(promptError);
		reject(promptError);
	});
	await accepted;
}

function requireSessionPath(session: AgentSession): string {
	if (!session.sessionFile) throw new PiError("session-not-persisted", "Pi 未创建持久化会话文件。");
	return session.sessionFile;
}

function hasTreeEntry(nodes: SessionTreeNode[], entryId: string): boolean {
	return nodes.some((node) => node.entry.id === entryId || hasTreeEntry(node.children, entryId));
}
