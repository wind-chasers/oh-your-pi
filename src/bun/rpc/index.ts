import { BrowserView } from "electrobun/bun";
import type { PiRpcSchema } from "@shared/pi-rpc";
import type { Application } from "@main/app";
import type { DesktopSystem } from "@main/desktop/system";

type DefinedPiRpc = ReturnType<typeof BrowserView.defineRPC<PiRpcSchema>>;

export type PiRpcBinding = {
	rpc: DefinedPiRpc;
	openAppSettings(): void;
	dispose(): void;
};

export function createPiRpc(options: { app: Application; desktop: DesktopSystem }): PiRpcBinding {
	const { app, desktop } = options;
	const rpc = BrowserView.defineRPC<PiRpcSchema>({
		maxRequestTime: Infinity,
		handlers: {
			requests: {
				loginProvider: (input) => app.authentication.login(input),
				cancelProviderLogin: (input) => app.authentication.cancel(input),
				respondAuthenticationPrompt: (input) => app.authentication.respond(input),
				inspectAuthentication: () => app.authentication.list(),
				inspectWorkspace: (input) => app.inspectWorkspace(input),
				refreshWorkspaceResources: (input) => app.refreshWorkspaceResources(input),
				chooseWorkspace: async () => ({
					workspacePath: await desktop.chooseWorkspaceDirectory(),
				}),
				chooseImageAttachments: async () =>
					app.session.inspectImageAttachments(await desktop.chooseImageFiles()),
				openWorkspaceFolder: (input) => desktop.openWorkspaceFolder(input.workspacePath),
				inspectWorkspaceGit: (input) => app.workspace.inspectGit(input),
				switchWorkspaceGitBranch: (input) => app.workspace.switchGitBranch(input),
				listWorkspaceFiles: (input) => app.workspace.listFiles(input),
				readWorkspaceFile: (input) => app.workspace.readFile(input),
				searchWorkspaceFiles: (input) => app.workspace.searchFiles(input),
				readSessionTranscript: (input) => app.session.readTranscript(input),
				openSession: (input) => app.session.open(input),
				createSession: (input) => app.session.create(input),
				continueRecentSession: (input) => app.session.continueRecent(input),
				renameSession: (input) => app.session.rename(input),
				deleteSession: (input) => app.session.delete(input),
				setSessionModel: (input) => app.session.setModel(input),
				setSessionThinking: (input) => app.session.setThinking(input),
				promptSession: (input) => app.session.prompt(input),
				regenerateSessionMessage: (input) => app.session.regenerate(input),
				steerSession: (input) => app.session.steer(input),
				followUpSession: (input) => app.session.followUp(input),
				abortSession: (input) => app.session.abort(input),
				respondToolPermission: (input) => app.session.respondPermission(input),
			},
		},
	});

	const unsubscribers = [
		app.authentication.subscribe((event) => {
			if (event.url) desktop.openExternalUrl(event.url);
			rpc.send.authenticationEvent(event);
		}),
		app.session.subscribe((event) => rpc.send.sessionEvent(event)),
		app.session.subscribePermissions((request) => rpc.send.toolPermissionRequest(request)),
	];
	let disposed = false;

	return {
		openAppSettings() {
			rpc.send.openAppSettings({});
		},
		rpc,
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const unsubscribe of unsubscribers) unsubscribe();
		},
	};
}
