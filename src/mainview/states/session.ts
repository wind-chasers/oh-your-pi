import type { PiOpenedSession } from "@shared/pi-contract";
import { mutate } from "@view/atom";
import type { UseAtom } from "@view/atom";
import {
	continueRecentPiSession,
	createPiSession,
	inspectPiWorkspace,
	openPiSession,
	readPiSessionTranscript,
} from "@view/lib/pi-client";
import { WorkspaceBusyAtom, WorkspaceErrorAtom } from "./activity.atom";
import { OpenedSessionAtom, WorkspaceAtom } from "./current.atom";

export const SelectSessionMutation = mutate((use) =>
	async function selectSession(sessionPath: string): Promise<void> {
		const [workspace] = use(WorkspaceAtom);
		if (!workspace) return;
		const workspacePath = workspace.workspacePath;
		const [, setOpenedSession] = use(OpenedSessionAtom);
		const [, setError] = use(WorkspaceErrorAtom);
		const [, setBusy] = use(WorkspaceBusyAtom);
		setError(undefined);
		setBusy(true);
		try {
			const openedSession = await openPiSession({
				sessionPath,
				workspacePath,
			});
			if (use(WorkspaceAtom)[0]?.workspacePath === workspacePath) {
				setOpenedSession(openedSession);
			}
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法打开 Pi 会话。"));
		} finally {
			setBusy(false);
		}
	},
);

export const CreateSessionMutation = mutate((use) =>
	async function createSession(): Promise<void> {
		await replace(use, (workspacePath) =>
			createPiSession({ workspacePath }),
		);
	},
);

export const ContinueRecentSessionMutation = mutate((use) =>
	async function continueRecentSession(): Promise<void> {
		await replace(use, (workspacePath) =>
			continueRecentPiSession({ workspacePath }),
		);
	},
);

export const RefreshSessionMutation = mutate((use) =>
	async function refreshSession(): Promise<void> {
		const [workspace, setWorkspace] = use(WorkspaceAtom);
		const [openedSession, setOpenedSession] = use(OpenedSessionAtom);
		if (!workspace || !openedSession) return;
		const workspacePath = workspace.workspacePath;
		const sessionPath = openedSession.runtime.sessionPath;
		const [transcript, nextWorkspace] = await Promise.all([
			readPiSessionTranscript({ sessionPath, workspacePath }),
			inspectPiWorkspace({ workspacePath }),
		]);
		if (use(WorkspaceAtom)[0]?.workspacePath !== workspacePath) return;
		setWorkspace(nextWorkspace);
		const currentSession = use(OpenedSessionAtom)[0];
		if (currentSession?.runtime.sessionPath !== sessionPath) return;
		setOpenedSession({
			...currentSession,
			runtime: { ...currentSession.runtime, isStreaming: false },
			transcript,
		});
	},
);

async function replace(
	use: UseAtom,
	create: (workspacePath: string) => Promise<PiOpenedSession>,
): Promise<void> {
	const [workspace, setWorkspace] = use(WorkspaceAtom);
	if (!workspace) return;
	const workspacePath = workspace.workspacePath;
	const [, setOpenedSession] = use(OpenedSessionAtom);
	const [, setError] = use(WorkspaceErrorAtom);
	const [, setBusy] = use(WorkspaceBusyAtom);
	setError(undefined);
	setBusy(true);
	try {
		const [nextSession, nextWorkspace] = await Promise.all([
			create(workspacePath),
			inspectPiWorkspace({ workspacePath }),
		]);
		if (use(WorkspaceAtom)[0]?.workspacePath !== workspacePath) return;
		setOpenedSession(nextSession);
		setWorkspace(nextWorkspace);
	} catch (requestError) {
		setError(toErrorMessage(requestError, "无法创建 Pi 会话。"));
	} finally {
		setBusy(false);
	}
}

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
