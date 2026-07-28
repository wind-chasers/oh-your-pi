import type {
	PiWorkspaceRefreshResult,
	PiWorkspaceRequest,
	PiWorkspaceSnapshot,
} from "@shared/pi-contract";
import type { PiRuntime } from "@main/pi";
import { AuthenticationApplication } from "./authentication";
import { SessionApplication } from "./session";
import { WorkspaceApplication } from "./workspace";

export class Application {
	readonly authentication: AuthenticationApplication;
	readonly session: SessionApplication;
	readonly workspace: WorkspaceApplication;
	private disposed = false;

	constructor(pi: PiRuntime) {
		this.authentication = new AuthenticationApplication(pi.authentication);
		this.workspace = new WorkspaceApplication(pi);
		this.session = new SessionApplication(pi, this.authentication);
	}

	async inspectWorkspace(input: PiWorkspaceRequest): Promise<PiWorkspaceSnapshot> {
		const workspace = await this.workspace.inspect(input);
		const [authentication, sessions] = await Promise.all([
			this.authentication.list(),
			this.session.list(workspace.workspacePath),
		]);
		return { ...workspace, authentication, sessions };
	}

	async refreshWorkspaceResources(input: PiWorkspaceRequest): Promise<PiWorkspaceRefreshResult> {
		const workspace = await this.workspace.refresh(input);
		const [authentication, sessions] = await Promise.all([
			this.authentication.list(),
			this.session.list(workspace.workspacePath),
		]);
		return { snapshot: { ...workspace, authentication, sessions } };
	}

	async dispose(): Promise<void> {
		if (this.disposed) return;
		this.disposed = true;
		this.session.dispose();
		this.authentication.dispose();
	}
}
