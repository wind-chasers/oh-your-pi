import type { PiPluginScope, PiPluginSnapshot } from "@shared/pi-contract";
import { atom, mutate } from "@view/atom";
import type { UseAtom } from "@view/atom";
import { chatStore } from "@view/chat-store";
import {
	inspectPiPlugins,
	installPiPlugin,
	refreshPiWorkspaceResources,
	removePiPlugin,
	setPiPluginEnabled,
	updatePiPlugin,
} from "@view/lib/pi-client";
import { WorkspaceErrorAtom } from "./activity.atom";
import { SelectedSessionAtom, WorkspaceAtom } from "./current.atom";
import { createToast, AppToastsAtom } from "./toast.atom";

export const PluginManagerDialogOpenAtom = atom(false);
export const PluginsAtom = atom<PiPluginSnapshot | undefined>(undefined);
export const PluginsBusyAtom = atom(false);

export const LoadPluginsMutation = mutate((use) =>
	async function loadPlugins(): Promise<void> {
		const [, setPlugins] = use(PluginsAtom);
		const [, setBusy] = use(PluginsBusyAtom);
		const [, setError] = use(WorkspaceErrorAtom);
		const workspacePath = use(WorkspaceAtom)[0]?.workspacePath;
		setBusy(true);
		setError(undefined);
		try {
			setPlugins(await inspectPiPlugins({ workspacePath }));
		} catch (error) {
			setError(toErrorMessage(error, "无法读取 Pi 插件。"));
		} finally {
			setBusy(false);
		}
	},
);

export const InstallPluginMutation = mutate((use) =>
	async function installPlugin(source: string, scope: PiPluginScope): Promise<boolean> {
		return mutatePlugins(use, (workspacePath) => installPiPlugin({ scope, source, workspacePath }), "无法安装 Pi 插件。", "插件已安装", source);
	},
);

export const UpdatePluginMutation = mutate((use) =>
	async function updatePlugin(source: string, scope: PiPluginScope): Promise<boolean> {
		return mutatePlugins(use, (workspacePath) => updatePiPlugin({ scope, source, workspacePath }), "无法更新 Pi 插件。", "插件已更新", source);
	},
);

export const RemovePluginMutation = mutate((use) =>
	async function removePlugin(source: string, scope: PiPluginScope): Promise<boolean> {
		return mutatePlugins(use, (workspacePath) => removePiPlugin({ scope, source, workspacePath }), "无法移除 Pi 插件。", "插件已移除", source);
	},
);

export const SetPluginEnabledMutation = mutate((use) =>
	async function setPluginEnabled(source: string, scope: PiPluginScope, enabled: boolean): Promise<boolean> {
		return mutatePlugins(
			use,
			(workspacePath) => setPiPluginEnabled({ enabled, scope, source, workspacePath }),
			"无法更新 Pi 插件状态。",
			enabled ? "插件已启用" : "插件已停用",
			source,
		);
	},
);

export const ReloadPluginSessionMutation = mutate((use) =>
	async function reloadPluginSession(): Promise<boolean> {
		const [workspace, setWorkspace] = use(WorkspaceAtom);
		const selection = use(SelectedSessionAtom)[0];
		if (!workspace || !selection || selection.workspacePath !== workspace.workspacePath) return false;
		const session = chatStore.getSession(selection.workspacePath, selection.sessionId);
		if (!session || session.activity.isStreaming) return false;

		const [, setBusy] = use(PluginsBusyAtom);
		const [, setError] = use(WorkspaceErrorAtom);
		setBusy(true);
		setError(undefined);
		try {
			const refreshed = await refreshPiWorkspaceResources({ workspacePath: workspace.workspacePath });
			if (use(WorkspaceAtom)[0]?.workspacePath !== workspace.workspacePath) return false;
			setWorkspace(refreshed.snapshot);
			await session.reload();
			return true;
		} catch (error) {
			setError(toErrorMessage(error, "无法刷新当前 Pi 会话。"));
			return false;
		} finally {
			setBusy(false);
		}
	},
);

async function mutatePlugins(
	use: UseAtom,
	request: (workspacePath: string | undefined) => Promise<PiPluginSnapshot>,
	fallback: string,
	title: string,
	source: string,
): Promise<boolean> {
	const [, setPlugins] = use(PluginsAtom);
	const [, setBusy] = use(PluginsBusyAtom);
	const [, setError] = use(WorkspaceErrorAtom);
	const [, setToasts] = use(AppToastsAtom);
	setBusy(true);
	setError(undefined);
	try {
		const workspacePath = use(WorkspaceAtom)[0]?.workspacePath;
		setPlugins(await request(workspacePath));
		const sessionWasReloaded = await refreshPluginWorkspace(use);
		setToasts((current) => [...current, createToast({
			description: sessionWasReloaded
				? source
				: `${source}。当前会话运行结束后，请手动刷新以应用新配置。`,
			title,
			variant: "success",
		})]);
		return true;
	} catch (error) {
		setError(toErrorMessage(error, fallback));
		return false;
	} finally {
		setBusy(false);
	}
}

async function refreshPluginWorkspace(use: UseAtom): Promise<boolean> {
	const [workspace, setWorkspace] = use(WorkspaceAtom);
	if (!workspace) return true;
	const workspacePath = workspace.workspacePath;
	try {
		const refreshed = await refreshPiWorkspaceResources({ workspacePath });
		if (use(WorkspaceAtom)[0]?.workspacePath !== workspacePath) return false;
		setWorkspace(refreshed.snapshot);
		return reloadSelectedSession(use, workspacePath);
	} catch {
		return false;
	}
}

async function reloadSelectedSession(use: UseAtom, workspacePath: string): Promise<boolean> {
	const selection = use(SelectedSessionAtom)[0];
	if (!selection || selection.workspacePath !== workspacePath) return true;
	const session = chatStore.getSession(selection.workspacePath, selection.sessionId);
	if (!session || session.activity.isStreaming) return false;
	try {
		await session.reload();
		return true;
	} catch {
		return false;
	}
}

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
