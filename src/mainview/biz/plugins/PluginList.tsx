import { Package, Plus } from "lucide-react";
import type { ReactElement } from "react";
import type { PiPlugin, PiPluginScope } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import { pluginKey, pluginScopeLabels, resourceSummary } from "./plugin-utils";

type PluginListProps = {
	busy: boolean;
	plugins: readonly PiPlugin[];
	selection: string | "add";
	onSelect: (selection: string | "add") => void;
};

export function PluginList({ busy, plugins, selection, onSelect }: PluginListProps): ReactElement {
	return (
		<aside className="flex w-60 shrink-0 flex-col border-r bg-muted/20">
			<div className="min-h-0 flex-1 overflow-y-auto p-2">
				<PluginScopeList plugins={plugins} scope="global" selection={selection} onSelect={onSelect} />
				<PluginScopeList plugins={plugins} scope="workspace" selection={selection} onSelect={onSelect} />
				{plugins.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">尚未安装插件。</p> : null}
			</div>
			<div className="border-t p-2">
				<Button className="w-full justify-start" disabled={busy} onClick={() => onSelect("add")} size="sm" type="button" variant={selection === "add" ? "secondary" : "ghost"}>
					<Plus aria-hidden data-icon="inline-start" />
					添加插件
				</Button>
			</div>
		</aside>
	);
}

function PluginScopeList({ plugins, scope, selection, onSelect }: {
	plugins: readonly PiPlugin[];
	scope: PiPluginScope;
	selection: string | "add";
	onSelect: (selection: string | "add") => void;
}): ReactElement | null {
	const scopedPlugins = plugins.filter((plugin) => plugin.scope === scope);
	if (scopedPlugins.length === 0) return null;
	return (
		<section className="mb-3 last:mb-0">
			<p className="px-2 py-2 text-xs font-medium tracking-wide text-muted-foreground">{pluginScopeLabels[scope]}</p>
			<div className="flex flex-col gap-1">
				{scopedPlugins.map((plugin) => (
					<Button className="h-auto w-full items-center justify-start px-2.5 py-2 text-left" key={pluginKey(plugin)} onClick={() => onSelect(pluginKey(plugin))} size="sm" type="button" variant={selection === pluginKey(plugin) ? "secondary" : "ghost"}>
						<Package aria-hidden data-icon="inline-start" />
						<span className="min-w-0 flex-1">
							<span className="block truncate font-mono text-xs">{plugin.source}</span>
							<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{resourceSummary(plugin)}</span>
						</span>
					</Button>
				))}
			</div>
		</section>
	);
}
