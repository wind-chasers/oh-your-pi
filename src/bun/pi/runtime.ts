import { realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { getAgentDir, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { PiAuthentication } from "./authentication";
import { PiSessionRegistry } from "./session/registry";
import { PiSession } from "./session";
import { PiWorkspace } from "./workspace";
import {
	inspectPiPlugins,
	installPiPlugin,
	removePiPlugin,
	setPiPluginEnabled,
	updatePiPlugin,
} from "./plugins";

type PiBunRuntime = {
	version: string;
	Image?: unknown;
};

export function assertPiRuntimeCapabilities(runtime: PiBunRuntime = Bun): void {
	if (typeof runtime.Image !== "function") {
		throw new Error(`桌面运行时 Bun ${runtime.version} 不支持 Bun.Image；需要 Bun 1.3.14 或更高版本。`);
	}
}

export function registerPiOAuthFlows(): void {
	registerBunOAuthFlows();
}

export class PiRuntime {
	readonly authentication: PiAuthentication;
	private disposed = false;
	private readonly workspaces = new Map<string, PiWorkspace>();

	private constructor(
		private readonly sessions: PiSessionRegistry,
		private readonly agentDir: string,
		private readonly modelRuntime: ModelRuntime,
	) {
		this.authentication = new PiAuthentication(modelRuntime);
	}

	static async create(): Promise<PiRuntime> {
		const agentDir = getAgentDir();
		const modelRuntime = await ModelRuntime.create({
			authPath: join(agentDir, "auth.json"),
			modelsPath: join(agentDir, "models.json"),
		});
		return new PiRuntime(new PiSessionRegistry(agentDir, modelRuntime), agentDir, modelRuntime);
	}

	async openWorkspace(workspacePath: string): Promise<PiWorkspace> {
		if (this.disposed) throw new Error("Pi runtime 已经关闭。");
		const resolvedWorkspacePath = await resolveWorkspacePath(workspacePath);
		const existing = this.workspaces.get(resolvedWorkspacePath);
		if (existing) return existing;
		const workspace = new PiWorkspace(
			resolvedWorkspacePath,
			this.agentDir,
			this.modelRuntime,
			this.sessions,
		);
		this.workspaces.set(resolvedWorkspacePath, workspace);
		return workspace;
	}

	async inspectPlugins(workspacePath?: string) {
		return inspectPiPlugins({ agentDir: this.agentDir, workspacePath: await this.resolvePluginWorkspace(workspacePath) });
	}

	async installPlugin(source: string, scope: "global" | "workspace", workspacePath?: string): Promise<void> {
		await installPiPlugin({ agentDir: this.agentDir, scope, source, workspacePath: await this.resolvePluginWorkspace(workspacePath) });
	}

	async updatePlugin(source: string, scope: "global" | "workspace", workspacePath?: string): Promise<void> {
		await updatePiPlugin({ agentDir: this.agentDir, scope, source, workspacePath: await this.resolvePluginWorkspace(workspacePath) });
	}

	async removePlugin(source: string, scope: "global" | "workspace", workspacePath?: string): Promise<void> {
		await removePiPlugin({ agentDir: this.agentDir, scope, source, workspacePath: await this.resolvePluginWorkspace(workspacePath) });
	}

	async setPluginEnabled(source: string, enabled: boolean, scope: "global" | "workspace", workspacePath?: string): Promise<void> {
		await setPiPluginEnabled({ agentDir: this.agentDir, enabled, scope, source, workspacePath: await this.resolvePluginWorkspace(workspacePath) });
	}

	private async resolvePluginWorkspace(workspacePath?: string): Promise<string | undefined> {
		if (!workspacePath) return undefined;
		return (await this.openWorkspace(workspacePath)).path;
	}

	getSession(sessionPath: string): PiSession {
		return this.sessions.get(sessionPath);
	}

	async closeSession(sessionPath: string): Promise<void> {
		await this.sessions.close(sessionPath);
	}

	async dispose(): Promise<void> {
		if (this.disposed) return;
		this.disposed = true;
		this.workspaces.clear();
		await this.sessions.dispose();
	}
}

async function resolveWorkspacePath(workspacePath: string): Promise<string> {
	const absolutePath = resolve(workspacePath);
	if (!(await stat(absolutePath)).isDirectory()) throw new Error(`Pi 工作区不是目录：${absolutePath}`);
	return realpath(absolutePath);
}
