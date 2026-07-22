import { basename } from "node:path";
import { createAgentSessionServices, getAgentDir, SessionManager, type AgentSessionServices, type ModelRuntime } from "@earendil-works/pi-coding-agent";
import { PiAuthenticationStatusSchema, PiWorkspaceSnapshotSchema, type PiAuthenticationStatus, type PiWorkspaceSnapshot } from "@shared/pi-contract";
import { toSessionSummary } from "./mapper";
import { redactSensitiveText } from "@main/pi/redaction";

export async function inspectWorkspaceSnapshot(workspacePath: string): Promise<PiWorkspaceSnapshot> {
	const services = await createAgentSessionServices({ cwd: workspacePath, agentDir: getAgentDir() });
	return toWorkspaceSnapshot(workspacePath, services);
}

async function toWorkspaceSnapshot(
	workspacePath: string,
	services: AgentSessionServices,
): Promise<PiWorkspaceSnapshot> {
	const resourceLoader = services.resourceLoader;
	const extensions = resourceLoader.getExtensions();
	const skills = resourceLoader.getSkills();
	const prompts = resourceLoader.getPrompts();
	const contextFiles = resourceLoader.getAgentsFiles();
	const authentication = await inspectAuthentication(services.modelRuntime);
	const diagnostics = [
		...services.diagnostics,
		...extensions.errors.map((error) => ({ type: "error" as const, message: `扩展 ${error.path}：${error.error}` })),
		...skills.diagnostics.map((diagnostic) => ({
			type: diagnostic.type === "error" ? "error" as const : "warning" as const,
			message: diagnostic.message,
		})),
		...prompts.diagnostics.map((diagnostic) => ({
			type: diagnostic.type === "error" ? "error" as const : "warning" as const,
			message: diagnostic.message,
		})),
	].map((diagnostic) => ({ ...diagnostic, message: redactSensitiveText(diagnostic.message) }));

	return PiWorkspaceSnapshotSchema.parse({
		workspacePath,
		agentDir: services.agentDir,
		resources: {
			extensions: extensions.extensions.length,
			skills: skills.skills.length,
			prompts: prompts.prompts.length,
			contextFiles: contextFiles.agentsFiles.length,
			extensionDetails: extensions.extensions.map((extension) => ({
				name: basename(extension.path),
				path: extension.resolvedPath,
				scope: extension.sourceInfo.scope,
				source: extension.sourceInfo.source,
				commands: [...extension.commands.keys()],
				tools: [...extension.tools.keys()],
			})),
			skillDetails: skills.skills.map((skill) => ({
				name: skill.name,
				path: skill.filePath,
				scope: skill.sourceInfo.scope,
				source: skill.sourceInfo.source,
			})),
			promptDetails: prompts.prompts.map((prompt) => ({
				name: prompt.name,
				path: prompt.filePath,
				scope: prompt.sourceInfo.scope,
				source: prompt.sourceInfo.source,
			})),
			diagnostics,
		},
		authentication,
		sessions: (await SessionManager.list(workspacePath)).map(toSessionSummary),
	});
}

export async function inspectAuthentication(modelRuntime: ModelRuntime): Promise<PiAuthenticationStatus[]> {
	return PiAuthenticationStatusSchema.array().parse(
		await Promise.all(modelRuntime.getProviders().map(async (provider) => {
			const loginMethods: Array<"oauth" | "api_key"> = [];
			if (provider.auth.oauth?.login) loginMethods.push("oauth");
			if (provider.auth.apiKey?.login) loginMethods.push("api_key");
			try {
				const auth = await modelRuntime.checkAuth(provider.id);
				return {
					provider: provider.id,
					name: provider.name,
					status: auth ? "available" as const : "unavailable" as const,
					type: auth?.type ?? null,
					loginMethods,
				};
			} catch {
				return { provider: provider.id, name: provider.name, status: "unknown" as const, type: null, loginMethods };
			}
		})),
	);
}

