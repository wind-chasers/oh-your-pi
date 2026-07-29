import type { PiSessionSummary } from "@shared/pi-contract";
import { mutate } from "@view/atom";
import type { UseAtom } from "@view/atom";
import { chatStore, type ChatSession } from "@view/chat-store";
import { deletePiSession, inspectPiWorkspace, renamePiSession } from "@view/lib/pi-client";
import { WorkspaceBusyAtom, WorkspaceErrorAtom } from "./activity.atom";
import { SelectedSessionAtom, WorkspaceAtom } from "./current.atom";
import type { SelectedChatSession } from "./current.atom";

export const SelectSessionMutation = mutate((use) =>
	async function selectSession(summary: PiSessionSummary): Promise<void> {
		const [workspace] = use(WorkspaceAtom);
		if (!workspace) return;
		const workspacePath = workspace.workspacePath;
		const [, setSelectedSession] = use(SelectedSessionAtom);
		const [, setError] = use(WorkspaceErrorAtom);
		const [, setBusy] = use(WorkspaceBusyAtom);
		setError(undefined);
		setBusy(true);
		try {
			const session = await chatStore.openSession(workspacePath, summary.id, summary.path);
			if (use(WorkspaceAtom)[0]?.workspacePath !== workspacePath) return;
			setSelectedSession(toSelection(session));
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法打开 Pi 会话。"));
		} finally {
			setBusy(false);
		}
	},
);

export const CreateSessionMutation = mutate((use) =>
	async function createSession(): Promise<void> {
		await createAndSelect(use, (workspacePath) => chatStore.createSession(workspacePath));
	},
);

export const ContinueRecentSessionMutation = mutate((use) =>
	async function continueRecentSession(): Promise<void> {
		await createAndSelect(use, (workspacePath) => chatStore.continueRecentSession(workspacePath));
	},
);

export const RenameSessionMutation = mutate((use) =>
	async function renameSession(summary: PiSessionSummary, name: string): Promise<void> {
		const [workspace, setWorkspace] = use(WorkspaceAtom);
		if (!workspace) return;
		const workspacePath = workspace.workspacePath;
		const [, setError] = use(WorkspaceErrorAtom);
		const [, setBusy] = use(WorkspaceBusyAtom);
		setError(undefined);
		setBusy(true);
		try {
			const result = await renamePiSession({
				workspacePath,
				sessionPath: summary.path,
				name,
			});
			if (use(WorkspaceAtom)[0]?.workspacePath === workspacePath) {
				setWorkspace((current) => {
					if (!current || current.workspacePath !== workspacePath) return current;
					return {
						...current,
						sessions: current.sessions.map((session) =>
							session.id === summary.id ? result.session : session,
						),
					};
				});
			}
			if (result.openedSession) {
				chatStore.getSession(workspacePath, summary.id)?.hydrate(result.openedSession);
			}
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法重命名 Pi 会话。"));
		} finally {
			setBusy(false);
		}
	},
);

export const DeleteSessionMutation = mutate((use) =>
	async function deleteSession(summary: PiSessionSummary): Promise<void> {
		const [workspace, setWorkspace] = use(WorkspaceAtom);
		if (!workspace) return;
		const workspacePath = workspace.workspacePath;
		const [, setSelectedSession] = use(SelectedSessionAtom);
		const [, setError] = use(WorkspaceErrorAtom);
		const [, setBusy] = use(WorkspaceBusyAtom);
		setError(undefined);
		setBusy(true);
		try {
			await deletePiSession({ workspacePath, sessionPath: summary.path });
			chatStore.removeSession(workspacePath, summary.id);
			if (use(WorkspaceAtom)[0]?.workspacePath === workspacePath) {
				setWorkspace((current) => {
					if (!current || current.workspacePath !== workspacePath) return current;
					return {
						...current,
						sessions: current.sessions.filter((session) => session.id !== summary.id),
					};
				});
				setSelectedSession((current) =>
					current?.sessionId === summary.id ? undefined : current,
				);
			}
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法删除 Pi 会话。"));
		} finally {
			setBusy(false);
		}
	},
);

async function createAndSelect(
	use: UseAtom,
	create: (workspacePath: string) => Promise<ChatSession>,
): Promise<void> {
	const [workspace, setWorkspace] = use(WorkspaceAtom);
	if (!workspace) return;
	const workspacePath = workspace.workspacePath;
	const [, setSelectedSession] = use(SelectedSessionAtom);
	const [, setError] = use(WorkspaceErrorAtom);
	const [, setBusy] = use(WorkspaceBusyAtom);
	setError(undefined);
	setBusy(true);
	try {
		const session = await create(workspacePath);
		if (use(WorkspaceAtom)[0]?.workspacePath !== workspacePath) return;
		setSelectedSession(toSelection(session));
		const nextWorkspace = await inspectPiWorkspace({ workspacePath });
		if (use(WorkspaceAtom)[0]?.workspacePath === workspacePath) {
			setWorkspace(nextWorkspace);
		}
	} catch (requestError) {
		setError(toErrorMessage(requestError, "无法创建 Pi 会话。"));
	} finally {
		setBusy(false);
	}
}

function toSelection(session: ChatSession): SelectedChatSession {
	return {
		workspacePath: session.workspacePath,
		sessionId: session.id,
		sessionPath: session.path,
	};
}

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
