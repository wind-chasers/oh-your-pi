import type {
	PiPluginInspectionRequest,
	PiPluginSetEnabledRequest,
	PiPluginSnapshot,
	PiPluginSourceRequest,
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

	constructor(private readonly pi: PiRuntime) {
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

	async inspectPlugins(input: PiPluginInspectionRequest): Promise<PiPluginSnapshot> {
		return this.pi.inspectPlugins(input.workspacePath);
	}

	async installPlugin(input: PiPluginSourceRequest): Promise<PiPluginSnapshot> {
		await this.pi.installPlugin(input.source, input.scope, input.workspacePath);
		return this.pi.inspectPlugins(input.workspacePath);
	}

	async updatePlugin(input: PiPluginSourceRequest): Promise<PiPluginSnapshot> {
		await this.pi.updatePlugin(input.source, input.scope, input.workspacePath);
		return this.pi.inspectPlugins(input.workspacePath);
	}

	async removePlugin(input: PiPluginSourceRequest): Promise<PiPluginSnapshot> {
		await this.pi.removePlugin(input.source, input.scope, input.workspacePath);
		return this.pi.inspectPlugins(input.workspacePath);
	}

	async setPluginEnabled(input: PiPluginSetEnabledRequest): Promise<PiPluginSnapshot> {
		await this.pi.setPluginEnabled(input.source, input.enabled, input.scope, input.workspacePath);
		return this.pi.inspectPlugins(input.workspacePath);
	}

	async dispose(): Promise<void> {
		if (this.disposed) return;
		this.disposed = true;
		this.session.dispose();
		this.authentication.dispose();
	}
}
