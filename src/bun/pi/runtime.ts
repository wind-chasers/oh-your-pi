import { join, resolve } from "node:path";
import {
	createAgentSessionFromServices,
	createAgentSessionServices,
	getAgentDir,
	ModelRuntime,
	SessionManager,
	type AgentSession,
	type AgentSessionEvent,
	type AgentSessionServices,
	type CreateAgentSessionServicesOptions,
	type SessionTreeNode,
} from "@earendil-works/pi-coding-agent";

type ExtensionFactory = NonNullable<
	NonNullable<CreateAgentSessionServicesOptions["resourceLoaderOptions"]>["extensionFactories"]
>[number];

type PiSessionHostOptions = {
	createExtensions: (getSessionPath: () => string | undefined) => ExtensionFactory[];
	modelRuntime: ModelRuntime;
	onDispose: (sessionPath: string) => void;
	onSessionEvent: (sessionPath: string, event: AgentSessionEvent) => void;
	workspacePath: string;
};

export type PiSessionHostState = {
	cwd: string;
	session: AgentSession;
	services: AgentSessionServices;
};

/** Owns one live SDK session. It never replaces this host with another session. */
export class PiSessionHost {
	private services: AgentSessionServices | undefined;
	private session: AgentSession | undefined;
	private sessionPath: string | undefined;
	private unsubscribe: (() => void) | undefined;

	private constructor(private readonly options: PiSessionHostOptions) {}

	static async create(options: PiSessionHostOptions, sessionManager: SessionManager): Promise<PiSessionHost> {
		const host = new PiSessionHost(options);
		await host.createSession(sessionManager);
		return host;
	}

	getSession(): AgentSession {
		if (!this.session) throw new Error("Pi 会话已经关闭。");
		return this.session;
	}

	getServices(): AgentSessionServices {
		if (!this.services) throw new Error("Pi 会话已经关闭。");
		return this.services;
	}

	getSessionPath(): string {
		if (!this.sessionPath) throw new Error("Pi 未创建持久化会话文件。");
		return this.sessionPath;
	}

	getRuntimeState(): PiSessionHostState {
		return {
			cwd: this.getServices().cwd,
			session: this.getSession(),
			services: this.getServices(),
		};
	}

	async rebuild(): Promise<void> {
		const sessionPath = this.getSessionPath();
		const selectedEntryId = this.getSession().sessionManager.getLeafId();
		await this.disposeSession();
		await this.createSession(SessionManager.open(sessionPath));
		if (selectedEntryId && hasTreeEntry(this.getSession().sessionManager.getTree(), selectedEntryId)) {
			await this.getSession().navigateTree(selectedEntryId, { summarize: false });
		}
	}

	async dispose(): Promise<void> {
		if (!this.session) return;
		const sessionPath = this.getSessionPath();
		await this.disposeSession();
		this.options.onDispose(sessionPath);
	}

	private async createSession(sessionManager: SessionManager): Promise<void> {
		const services = await createAgentSessionServices({
			agentDir: getAgentDir(),
			cwd: this.options.workspacePath,
			modelRuntime: this.options.modelRuntime,
			resourceLoaderOptions: {
				extensionFactories: this.options.createExtensions(() => this.sessionPath),
			},
		});
		const { session } = await createAgentSessionFromServices({ services, sessionManager });
		this.services = services;
		this.session = session;
		this.sessionPath = requireSessionPath(session);
		await session.bindExtensions({});
		const sessionPath = this.sessionPath;
		this.unsubscribe = session.subscribe((event) => this.options.onSessionEvent(sessionPath, event));
	}

	private async disposeSession(): Promise<void> {
		const session = this.getSession();
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.session = undefined;
		this.services = undefined;
		await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
		session.dispose();
	}
}

type PiWorkspaceHostOptions = Omit<PiSessionHostOptions, "modelRuntime" | "workspacePath" | "onDispose"> & {
	onSessionDispose: (sessionPath: string) => void;
	workspacePath: string;
};

/** Caches live sessions for one workspace without choosing an active one. */
export class PiWorkspaceHost {
	private readonly sessions = new Map<string, PiSessionHost>();

	private constructor(
		private readonly options: PiWorkspaceHostOptions,
		private readonly modelRuntime: ModelRuntime,
	) {}

	static async create(options: PiWorkspaceHostOptions): Promise<PiWorkspaceHost> {
		const agentDir = getAgentDir();
		const modelRuntime = await ModelRuntime.create({
			authPath: join(agentDir, "auth.json"),
			modelsPath: join(agentDir, "models.json"),
		});
		return new PiWorkspaceHost(options, modelRuntime);
	}

	getModelRuntime(): ModelRuntime {
		return this.modelRuntime;
	}

	getSession(sessionPath: string): PiSessionHost {
		const host = this.sessions.get(resolve(sessionPath));
		if (!host) throw new Error("该会话尚未在主进程打开。");
		return host;
	}

	async open(sessionManager: SessionManager): Promise<PiSessionHost> {
		const sessionPath = sessionManager.getSessionFile();
		if (!sessionPath) throw new Error("Pi 未创建持久化会话文件。");
		const key = resolve(sessionPath);
		const existing = this.sessions.get(key);
		if (existing) return existing;

		const host = await PiSessionHost.create(
			{
				...this.options,
				modelRuntime: this.modelRuntime,
				onDispose: (path) => this.options.onSessionDispose(path),
			},
			sessionManager,
		);
		this.sessions.set(key, host);
		return host;
	}

	async createSession(): Promise<PiSessionHost> {
		return this.open(SessionManager.create(this.options.workspacePath));
	}

	async continueRecentSession(): Promise<PiSessionHost> {
		return this.open(SessionManager.continueRecent(this.options.workspacePath));
	}

	async rebuildIdleSessions(): Promise<void> {
		for (const host of this.sessions.values()) {
			if (host.getSession().isIdle) await host.rebuild();
		}
	}
}

function requireSessionPath(session: AgentSession): string {
	if (!session.sessionFile) throw new Error("Pi 未创建持久化会话文件。");
	return session.sessionFile;
}

function hasTreeEntry(nodes: SessionTreeNode[], entryId: string): boolean {
	return nodes.some((node) => node.entry.id === entryId || hasTreeEntry(node.children, entryId));
}
