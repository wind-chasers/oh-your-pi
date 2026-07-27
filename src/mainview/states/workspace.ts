import { mutate } from "@view/atom";
import type { UseAtom } from "@view/atom";
import {
	choosePiWorkspace,
	inspectPiWorkspace,
} from "@view/lib/pi-client";
import { WorkspaceBusyAtom, WorkspaceErrorAtom } from "./activity.atom";
import { AuthenticationAtom } from "./authentication.atom";
import { OpenedSessionAtom, WorkspaceAtom } from "./current.atom";
import { RecentWorkspacesAtom } from "./preferences.atom";

export const LoadWorkspaceMutation = mutate((use) =>
	async function loadWorkspace(path: string): Promise<void> {
		await load(use, path);
	},
);

export const ChooseWorkspaceMutation = mutate((use) =>
	async function chooseWorkspace(): Promise<void> {
		const [, setError] = use(WorkspaceErrorAtom);
		setError(undefined);
		try {
			const { workspacePath } = await choosePiWorkspace();
			if (workspacePath) await load(use, workspacePath);
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法打开工作区选择器。"));
		}
	},
);

async function load(use: UseAtom, path: string): Promise<void> {
	const nextPath = path.trim();
	if (!nextPath) return;

	const [currentWorkspace, setWorkspace] = use(WorkspaceAtom);
	const [, setOpenedSession] = use(OpenedSessionAtom);
	const [, setError] = use(WorkspaceErrorAtom);
	const [, setBusy] = use(WorkspaceBusyAtom);
	setError(undefined);
	setBusy(true);
	try {
		const nextWorkspace = await inspectPiWorkspace({
			workspacePath: nextPath,
		});
		setWorkspace(nextWorkspace);
		use(RecentWorkspacesAtom)[1].add(nextWorkspace.workspacePath);
		if (
			currentWorkspace?.workspacePath !== undefined &&
			currentWorkspace.workspacePath !== nextWorkspace.workspacePath
		) {
			setOpenedSession(undefined);
		}
		void use(AuthenticationAtom)[1].refresh().catch(() => undefined);
	} catch (requestError) {
		setError(toErrorMessage(requestError, "无法读取 Pi 工作区。"));
	} finally {
		setBusy(false);
	}
}

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
