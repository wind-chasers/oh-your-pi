import { FileText, Package, RefreshCw, Trash2, Wrench } from "lucide-react";
import { type ReactElement, useMemo } from "react";
import type { PiPlugin, PiPluginResource, PiPluginResourceKind, PiPluginScope } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import { Switch } from "@view/components/ui/switch";
import { cn } from "@view/lib/utils";
import { groupResources, resourceLabels, resourceSummary } from "./plugin-utils";

type PluginDetailsProps = {
	busy: boolean;
	plugin: PiPlugin;
	onReloadSession: () => Promise<boolean>;
	onRemove: (source: string, scope: PiPluginScope) => void;
	onSetEnabled: (source: string, scope: PiPluginScope, enabled: boolean) => Promise<boolean>;
	onUpdate: (source: string, scope: PiPluginScope) => Promise<boolean>;
};

export function PluginDetails({
	busy,
	plugin,
	onReloadSession,
	onRemove,
	onSetEnabled,
	onUpdate,
}: PluginDetailsProps): ReactElement {
	const resources = useMemo(() => groupResources(plugin.resources), [plugin.resources]);
	return (
		<section className="flex min-h-full flex-col gap-6 px-7 py-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex items-center gap-3">
						<Switch
							aria-label={`${plugin.enabled ? "停用" : "启用"} ${plugin.source}`}
							checked={plugin.enabled}
							disabled={busy || !plugin.toggleable}
							onCheckedChange={(enabled) => void onSetEnabled(plugin.source, plugin.scope, enabled)}
						/>
						<h2 className="truncate font-mono text-base font-medium">{plugin.source}</h2>
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						{plugin.enabled ? "已加载到新的空闲会话。" : "已安装，但资源未加载。"}
						{!plugin.toggleable ? " 此插件使用自定义资源筛选。" : ""}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button disabled={busy} onClick={() => void onUpdate(plugin.source, plugin.scope)} size="sm" type="button" variant="outline">
						<RefreshCw aria-hidden data-icon="inline-start" />
						更新
					</Button>
					<Button disabled={busy} onClick={() => void onReloadSession()} size="sm" type="button" variant="outline">
						<RefreshCw aria-hidden data-icon="inline-start" />
						刷新会话
					</Button>
					<Button disabled={busy} onClick={() => onRemove(plugin.source, plugin.scope)} size="sm" type="button" variant="destructive">
						<Trash2 aria-hidden data-icon="inline-start" />
						移除
					</Button>
				</div>
			</div>
			<dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
				<MetaRow label="状态" value={plugin.enabled ? "已加载" : "已停用"} />
				<MetaRow label="版本" value={plugin.installedVersion ?? "未找到 package.json"} mono />
				<MetaRow label="安装路径" value={plugin.installedPath ?? "尚未安装"} mono />
				<MetaRow label="资源" value={resourceSummary(plugin)} />
			</dl>
			<div className="border-t pt-5">
				<h3 className="font-medium">资源</h3>
				<p className="mt-1 text-xs text-muted-foreground">Pi 从该 package 解析到的资源。</p>
				<div className="mt-4 flex flex-col">
					{(["extension", "skill", "prompt"] as const).map((kind) => (
						<ResourceGroup key={kind} kind={kind} resources={resources[kind]} />
					))}
				</div>
			</div>
		</section>
	);
}

function ResourceGroup({ kind, resources }: { kind: PiPluginResourceKind; resources: readonly PiPluginResource[] }): ReactElement | null {
	if (resources.length === 0) return null;
	let Icon = FileText;
	if (kind === "extension") Icon = Wrench;
	if (kind === "skill") Icon = Package;
	return (
		<section className="border-b py-3 last:border-b-0">
			<h4 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground">
				<Icon aria-hidden />
				{resourceLabels[kind]} · {resources.length}
			</h4>
			<div className="mt-2 flex flex-col gap-2">
				{resources.map((resource) => (
					<div className="flex min-w-0 flex-col gap-0.5" key={resource.path}>
						<span className={cn("font-mono text-sm", !resource.enabled && "text-muted-foreground")}>{resource.name}</span>
						<span className="truncate font-mono text-xs text-muted-foreground" title={resource.path}>{resource.path}</span>
					</div>
				))}
			</div>
		</section>
	);
}

function MetaRow({ label, mono = false, value }: { label: string; mono?: boolean; value: string }): ReactElement {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className={cn("min-w-0 break-all", mono && "font-mono text-xs")}>{value}</dd>
		</>
	);
}
