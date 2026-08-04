import { LoaderCircle, RefreshCw } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import type { PiPlugin } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@view/components/ui/dialog";
import {
	InstallPluginMutation,
	LoadPluginsMutation,
	PluginManagerDialogOpenAtom,
	PluginsAtom,
	PluginsBusyAtom,
	ReloadPluginSessionMutation,
	RemovePluginMutation,
	SetPluginEnabledMutation,
	UpdatePluginMutation,
} from "@view/states/plugins";
import { WorkspaceAtom } from "@view/states/current.atom";
import { AddPluginPane } from "./AddPluginPane";
import { PluginDetails } from "./PluginDetails";
import { PluginList } from "./PluginList";
import { RemovePluginDialog } from "./RemovePluginDialog";
import { pluginKey } from "./plugin-utils";

export function PluginManagerDialog(): ReactElement {
	const [open, setOpen] = PluginManagerDialogOpenAtom.use();
	const plugins = PluginsAtom.useValue();
	const workspace = WorkspaceAtom.useValue();
	const busy = PluginsBusyAtom.useValue();
	const load = LoadPluginsMutation.use();
	const install = InstallPluginMutation.use();
	const update = UpdatePluginMutation.use();
	const remove = RemovePluginMutation.use();
	const setEnabled = SetPluginEnabledMutation.use();
	const reloadSession = ReloadPluginSessionMutation.use();
	const [selection, setSelection] = useState<string | "add">("add");
	const [pendingRemove, setPendingRemove] = useState<PiPlugin>();

	useEffect(() => {
		if (open) void load();
	}, [load, open]);

	useEffect(() => {
		if (!plugins || selection === "add" || plugins.plugins.some((plugin) => pluginKey(plugin) === selection)) return;
		setSelection(plugins.plugins[0] ? pluginKey(plugins.plugins[0]) : "add");
	}, [plugins, selection]);

	const selectedPlugin = plugins?.plugins.find((plugin) => pluginKey(plugin) === selection);
	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogContent
				className="flex h-[min(42rem,calc(100dvh-2rem))] w-[calc(100dvw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[60rem] sm:!max-w-none"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
					<DialogTitle>插件管理</DialogTitle>
					<DialogDescription>管理此设备上安装的 Pi 扩展、技能与提示词。</DialogDescription>
				</DialogHeader>
				<div className="flex min-h-0 flex-1 overflow-hidden">
					<PluginList busy={busy} plugins={plugins?.plugins ?? []} selection={selection} onSelect={setSelection} />
					<main className="min-w-0 flex-1 overflow-y-auto">
						{selection === "add" ? <AddPluginPane busy={busy} install={install} workspaceAvailable={Boolean(workspace)} /> : null}
						{selectedPlugin ? (
							<PluginDetails
								busy={busy}
								plugin={selectedPlugin}
								onReloadSession={reloadSession}
								onRemove={() => setPendingRemove(selectedPlugin)}
								onSetEnabled={setEnabled}
								onUpdate={update}
							/>
						) : null}
						{selection !== "add" && !selectedPlugin ? <LoadingPane /> : null}
					</main>
				</div>
				<footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
					<p className="text-xs text-muted-foreground">显示全局与当前工作区的 Pi packages。</p>
					<div className="flex items-center gap-2">
						<Button disabled={busy} onClick={() => void load()} size="sm" type="button" variant="outline">
							<RefreshCw aria-hidden data-icon="inline-start" />
							刷新
						</Button>
						<DialogClose asChild>
							<Button size="sm" type="button" variant="outline">关闭</Button>
						</DialogClose>
					</div>
				</footer>
			</DialogContent>
			<RemovePluginDialog
				busy={busy}
				plugin={pendingRemove}
				onOpenChange={(nextOpen) => !nextOpen && setPendingRemove(undefined)}
				onRemove={(source, scope) => void remove(source, scope)}
			/>
		</Dialog>
	);
}

function LoadingPane(): ReactElement {
	return (
		<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
			<LoaderCircle aria-hidden className="animate-spin" />
			正在读取插件…
		</div>
	);
}
