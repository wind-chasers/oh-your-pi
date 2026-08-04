import type { PiPlugin, PiPluginResource, PiPluginResourceKind } from "@shared/pi-contract";

export const resourceLabels: Record<PiPluginResourceKind, string> = {
	extension: "扩展",
	prompt: "提示词",
	skill: "技能",
};

export const pluginScopeLabels = {
	global: "全局插件",
	workspace: "工作区插件",
} as const;

export function pluginKey(plugin: Pick<PiPlugin, "scope" | "source">): string {
	return `${plugin.scope}:${plugin.source}`;
}

export function groupResources(resources: readonly PiPluginResource[]): Record<PiPluginResourceKind, PiPluginResource[]> {
	return resources.reduce<Record<PiPluginResourceKind, PiPluginResource[]>>((groups, resource) => {
		groups[resource.kind].push(resource);
		return groups;
	}, { extension: [], prompt: [], skill: [] });
}

export function resourceSummary(plugin: PiPlugin): string {
	const counts = groupResources(plugin.resources);
	const entries = (["extension", "skill", "prompt"] as const)
		.filter((kind) => counts[kind].length > 0)
		.map((kind) => `${counts[kind].length} ${resourceLabels[kind]}`);
	return entries.length > 0 ? entries.join(" · ") : "没有可加载资源";
}
