import type {
	PiResourceSummary,
	PiWorkspaceFile,
	PiWorkspaceFileContent,
	PiWorkspaceFileRequest,
	PiWorkspaceRequest,
} from "@shared/pi-contract";
import type { PiRuntime } from "@main/pi";
import { redactSensitiveText } from "@main/utils/redact-sensitive-text";
import { listWorkspaceFiles, readWorkspaceFile } from "./files";

type WorkspaceResourceSnapshot = {
	workspacePath: string;
	agentDir: string;
	resources: PiResourceSummary;
};

export class WorkspaceApplication {
	constructor(private readonly pi: PiRuntime) {}

	async inspect(input: PiWorkspaceRequest): Promise<WorkspaceResourceSnapshot> {
		const workspace = await this.pi.openWorkspace(input.workspacePath);
		const snapshot = await workspace.inspectResources();
		return {
			workspacePath: workspace.path,
			agentDir: snapshot.agentDir,
			resources: {
				extensions: snapshot.extensions.length,
				skills: snapshot.skills.length,
				prompts: snapshot.prompts.length,
				contextFiles: snapshot.contextFileCount,
				extensionDetails: snapshot.extensions,
				skillDetails: snapshot.skills,
				promptDetails: snapshot.prompts,
				diagnostics: snapshot.diagnostics.map((diagnostic) => ({
					...diagnostic,
					message: redactSensitiveText(diagnostic.message),
				})),
			},
		};
	}

	async refresh(input: PiWorkspaceRequest): Promise<WorkspaceResourceSnapshot> {
		const workspace = await this.pi.openWorkspace(input.workspacePath);
		await workspace.rebuildIdleSessions();
		return this.inspect({ workspacePath: workspace.path });
	}

	async listFiles(input: PiWorkspaceFileRequest): Promise<PiWorkspaceFile[]> {
		return listWorkspaceFiles(input);
	}

	async readFile(input: PiWorkspaceFileRequest): Promise<PiWorkspaceFileContent> {
		return readWorkspaceFile(input);
	}
}
