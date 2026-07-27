import type { PiSessionSummary } from "@shared/pi-contract";
import { mutate } from "@view/atom";
import type { UseAtom } from "@view/atom";
import { chatStore, type ChatSession } from "@view/chat-store";
import { inspectPiWorkspace } from "@view/lib/pi-client";
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
