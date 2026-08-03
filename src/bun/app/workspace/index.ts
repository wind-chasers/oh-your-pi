import type {
	PiResourceSummary,
	PiWorkspaceGit,
	PiWorkspaceGitBranchRequest,
	PiWorkspaceFile,
	PiWorkspaceFileContent,
	PiWorkspaceFileRequest,
	PiWorkspaceRequest,
	PiFileSearchRequest,
	PiFileSearchResult,
} from "@shared/pi-contract";
import type { PiRuntime } from "@main/pi";
import { redactSensitiveText } from "@main/utils/redact-sensitive-text";
import { listWorkspaceFiles, readWorkspaceFile } from "./files";
import { inspectWorkspaceGit, switchWorkspaceGitBranch } from "./git";
import { searchWorkspaceFiles } from "./search";

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

	async searchFiles(input: PiFileSearchRequest): Promise<PiFileSearchResult> {
		return searchWorkspaceFiles(input);
	}

	async readFile(input: PiWorkspaceFileRequest): Promise<PiWorkspaceFileContent> {
		return readWorkspaceFile(input);
	}

	async inspectGit(input: PiWorkspaceRequest): Promise<PiWorkspaceGit | null> {
		return inspectWorkspaceGit(input.workspacePath);
	}

	async switchGitBranch(input: PiWorkspaceGitBranchRequest): Promise<PiWorkspaceGit> {
		return switchWorkspaceGitBranch(input);
	}
}
