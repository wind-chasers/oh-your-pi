import { BrowserView, Utils } from "electrobun/bun";
import type { PiRpcSchema } from "@shared/pi-rpc";
import { listWorkspaceFiles, readWorkspaceFile } from "@main/workspace/files";
import { PiWorkspaceService } from "@main/workspace/service";

export function createPiRpc(workspaceService: PiWorkspaceService) {
	const rpc = BrowserView.defineRPC<PiRpcSchema>({
		maxRequestTime: Infinity,
		handlers: {
			requests: {
				loginProvider: (input) => workspaceService.loginProvider(input),
				cancelProviderLogin: (input) => workspaceService.cancelProviderLogin(input),
				respondAuthenticationPrompt: (input) => workspaceService.respondAuthenticationPrompt(input),
				inspectAuthentication: () => workspaceService.inspectAuthentication(),
				inspectWorkspace: (input) => workspaceService.inspect(input),
				refreshWorkspaceResources: (input) => workspaceService.refreshResources(input),
				chooseWorkspace: async () => {
					const [workspacePath] = await Utils.openFileDialog({
						allowsMultipleSelection: false,
						canChooseDirectory: true,
						canChooseFiles: false,
					});
					return { workspacePath: workspacePath || null };
				},
				listWorkspaceFiles: (input) => listWorkspaceFiles(input),
				readWorkspaceFile: (input) => readWorkspaceFile(input),
				readSessionTranscript: (input) => workspaceService.readTranscript(input),
				openSession: (input) => workspaceService.openSession(input),
				createSession: (input) => workspaceService.createSession(input),
				continueRecentSession: (input) => workspaceService.continueRecentSession(input),
				setSessionModel: (input) => workspaceService.setModel(input),
				setSessionThinking: (input) => workspaceService.setThinking(input),
				promptSession: (input) => workspaceService.prompt(input),
				steerSession: (input) => workspaceService.steer(input),
				followUpSession: (input) => workspaceService.followUp(input),
				abortSession: (input) => workspaceService.abort(input),
				respondToolPermission: (input) => workspaceService.respondToolPermission(input),
			},
		},
	});

	workspaceService.setEventHandler((event) => rpc.send.sessionEvent(event));
	workspaceService.setPermissionHandler((request) => rpc.send.toolPermissionRequest(request));
	workspaceService.setAuthenticationEventHandler((event) => {
		if (event.url) Utils.openExternal(event.url);
		rpc.send.authenticationEvent(event);
	});
	return rpc;
}
