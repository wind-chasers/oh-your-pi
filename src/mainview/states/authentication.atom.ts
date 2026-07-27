import type {
	PiAuthenticationMethod,
	PiAuthenticationStatus,
} from "@shared/pi-contract";
import { atom } from "@view/atom";
import {
	cancelPiProviderLogin,
	inspectPiAuthentication,
	loginPiProvider,
	openPiSession,
	refreshPiWorkspaceResources,
} from "@view/lib/pi-client";
import {
	AuthenticationBusyAtom,
	WorkspaceErrorAtom,
} from "./activity.atom";
import { OpenedSessionAtom, WorkspaceAtom } from "./current.atom";

export const AuthenticationDialogOpenAtom = atom(false);

export const AuthenticationAtom = atom(
	undefined as PiAuthenticationStatus[] | undefined,
	(_get, set, use) => {
		function setStatuses(statuses: PiAuthenticationStatus[]): void {
			set(statuses);
		}

		async function refresh(): Promise<void> {
			set(await inspectPiAuthentication());
		}

		async function cancel(provider: string): Promise<void> {
			await cancelPiProviderLogin({ provider });
		}

		async function login(
			provider: string,
			authType: PiAuthenticationMethod,
		): Promise<void> {
			const [isAuthenticating, setIsAuthenticating] = use(
				AuthenticationBusyAtom,
			);
			if (isAuthenticating) return;

			const [, setError] = use(WorkspaceErrorAtom);
			setIsAuthenticating(true);
			setError(undefined);
			try {
				await loginPiProvider({ authType, provider });
				await refresh();

				const [workspace, setWorkspace] = use(WorkspaceAtom);
				if (!workspace) return;
				const workspacePath = workspace.workspacePath;
				const refreshed = await refreshPiWorkspaceResources({ workspacePath });
				if (use(WorkspaceAtom)[0]?.workspacePath !== workspacePath) return;
				setWorkspace(refreshed.snapshot);

				const [openedSession, setOpenedSession] = use(OpenedSessionAtom);
				if (!openedSession) return;
				const sessionPath = openedSession.runtime.sessionPath;
				const reopened = await openPiSession({ sessionPath, workspacePath });
				const currentWorkspace = use(WorkspaceAtom)[0];
				const currentSession = use(OpenedSessionAtom)[0];
				if (
					currentWorkspace?.workspacePath === workspacePath &&
					currentSession?.runtime.sessionPath === sessionPath
				) {
					setOpenedSession(reopened);
				}
			} catch (requestError) {
				setError(toErrorMessage(requestError, "无法完成 Pi 提供商登录。"));
				throw requestError;
			} finally {
				setIsAuthenticating(false);
			}
		}

		void refresh().catch(() => undefined);
		return { cancel, login, refresh, setStatuses };
	},
);

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
