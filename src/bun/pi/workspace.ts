import { basename, resolve } from "node:path";
import {
	createAgentSessionServices,
	type ModelRuntime,
	SessionManager,
	type SessionInfo,
} from "@earendil-works/pi-coding-agent";
import type {
	PiExtensionResource,
	PiResourceDiagnostic,
	PiResourceItem,
	PiSkillResource,
	PiSessionSummary,
	PiOpenedSession,
	PiSessionTranscript,
} from "@shared/pi-contract";
import { PiSessionRegistry } from "./session/registry";
import {
	PiSession,
	type PiSessionHooks,
	toPiSessionTranscriptEntries,
	toPiSessionSummary,
} from "./session";

export type PiResourceSnapshot = {
	agentDir: string;
	extensions: PiExtensionResource[];
	skills: PiSkillResource[];
	prompts: PiResourceItem[];
	contextFileCount: number;
	diagnostics: PiResourceDiagnostic[];
};

export class PiWorkspace {
	constructor(
		readonly path: string,
		private readonly agentDir: string,
		private readonly modelRuntime: ModelRuntime,
		private readonly sessions: PiSessionRegistry,
	) {}

	async inspectResources(): Promise<PiResourceSnapshot> {
		const services = await createAgentSessionServices({
			agentDir: this.agentDir,
			cwd: this.path,
			modelRuntime: this.modelRuntime,
		});
		const extensions = services.resourceLoader.getExtensions();
		const skills = services.resourceLoader.getSkills();
		const prompts = services.resourceLoader.getPrompts();
		const contextFiles = services.resourceLoader.getAgentsFiles();
		const diagnostics = [
			...services.diagnostics,
			...extensions.errors.map((error) => ({
				type: "error" as const,
				message: `扩展 ${error.path}：${error.error}`,
			})),
			...skills.diagnostics.map((diagnostic) => ({
				type: diagnostic.type === "error" ? "error" as const : "warning" as const,
				message: diagnostic.message,
			})),
			...prompts.diagnostics.map((diagnostic) => ({
				type: diagnostic.type === "error" ? "error" as const : "warning" as const,
				message: diagnostic.message,
			})),
		];

		return {
			agentDir: services.agentDir,
			extensions: extensions.extensions.map((extension) => ({
				name: basename(extension.path),
				path: extension.resolvedPath,
				scope: extension.sourceInfo.scope,
				source: extension.sourceInfo.source,
				commands: [...extension.commands.keys()],
				tools: [...extension.tools.keys()],
			})),
			skills: skills.skills.map((skill) => ({
				description: skill.description,
				name: skill.name,
				path: skill.filePath,
				scope: skill.sourceInfo.scope,
				source: skill.sourceInfo.source,
			})),
			prompts: prompts.prompts.map((prompt) => ({
				name: prompt.name,
				path: prompt.filePath,
				scope: prompt.sourceInfo.scope,
				source: prompt.sourceInfo.source,
			})),
			contextFileCount: contextFiles.agentsFiles.length,
			diagnostics,
		};
	}

	async listSessions(): Promise<PiSessionSummary[]> {
		return (await SessionManager.list(this.path)).map(toPiSessionSummary);
	}

	async readSession(sessionPath: string): Promise<PiSessionTranscript> {
		const info = await this.findSession(sessionPath);
		const manager = SessionManager.open(info.path);
		return {
			session: toPiSessionSummary(info),
			entries: toPiSessionTranscriptEntries(manager.buildContextEntries()),
		};
	}

	async renameSession(sessionPath: string, name: string): Promise<{
		session: PiSessionSummary;
		openedSession?: PiOpenedSession;
	}> {
		const info = await this.findSession(sessionPath);
		const openedSession = this.sessions.find(info.path);
		if (openedSession) {
			openedSession.setName(name);
			const snapshot = openedSession.getSnapshot();
			return { session: snapshot.transcript.session, openedSession: snapshot };
		}
		SessionManager.open(info.path).appendSessionInfo(name);
		return { session: toPiSessionSummary(await this.findSession(info.path)) };
	}

	async deleteSession(sessionPath: string): Promise<string> {
		const info = await this.findSession(sessionPath);
		await this.sessions.delete(info.path);
		return info.path;
	}

	async forkSession(sessionPath: string, hooks: PiSessionHooks): Promise<PiSession> {
		const info = await this.findSession(sessionPath);
		const source = this.sessions.get(info.path);
		if (!source.isIdle) throw new Error("Pi 正在运行，请完成或中止后再复制会话。");
		return this.sessions.open({
			hooks,
			sessionManager: source.createClonedSessionManager(),
			workspacePath: this.path,
		});
	}

	async dropSession(sessionPath: string, hooks: PiSessionHooks): Promise<PiSession> {
		const info = await this.findSession(sessionPath);
		const source = this.sessions.get(info.path);
		if (!source.isIdle) throw new Error("Pi 正在运行，请完成或中止后再删除会话。");
		const replacement = await this.createSession(hooks);
		try {
			await this.sessions.delete(info.path);
			return replacement;
		} catch (error) {
			await this.sessions.delete(replacement.path).catch(() => undefined);
			throw error;
		}
	}

	async openSession(sessionPath: string, hooks: PiSessionHooks): Promise<PiSession> {
		const info = await this.findSession(sessionPath);
		return this.sessions.open({
			hooks,
			sessionInfo: info,
			sessionManager: SessionManager.open(info.path),
			workspacePath: this.path,
		});
	}

	async createSession(hooks: PiSessionHooks): Promise<PiSession> {
		return this.sessions.open({
			hooks,
			sessionManager: SessionManager.create(this.path),
			workspacePath: this.path,
		});
	}

	async continueRecentSession(hooks: PiSessionHooks): Promise<PiSession> {
		const manager = SessionManager.continueRecent(this.path);
		const sessionPath = manager.getSessionFile();
		const info = sessionPath ? await this.findSession(sessionPath) : undefined;
		return this.sessions.open({
			hooks,
			sessionInfo: info,
			sessionManager: manager,
			workspacePath: this.path,
		});
	}

	async rebuildIdleSessions(): Promise<void> {
		await this.sessions.rebuildIdleSessions(this.path);
	}

	private async findSession(sessionPath: string): Promise<SessionInfo> {
		const resolvedSessionPath = resolve(sessionPath);
		const session = (await SessionManager.list(this.path))
			.find((candidate) => resolve(candidate.path) === resolvedSessionPath);
		if (!session) throw new Error("该会话不属于所选 Pi 工作区。");
		return session;
	}
}
