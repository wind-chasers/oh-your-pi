import { basename, dirname, extname, join } from "node:path";
import {
	DefaultPackageManager,
	SettingsManager,
	type PackageSource,
	type ResolvedPaths,
} from "@earendil-works/pi-coding-agent";
import type {
	PiPlugin,
	PiPluginResource,
	PiPluginScope,
	PiPluginSnapshot,
} from "@shared/pi-contract";

type PluginContext = { agentDir: string; workspacePath?: string };
type PluginAction = PluginContext & { scope: PiPluginScope; source: string };
type ConfiguredPlugin = ReturnType<DefaultPackageManager["listConfiguredPackages"]>[number];
type ManagedPluginContext = PluginContext & {
	packageManager: DefaultPackageManager;
	settingsManager: SettingsManager;
};

const RESOURCE_KINDS = ["extensions", "skills", "prompts"] as const;

export async function inspectPiPlugins(input: PluginContext): Promise<PiPluginSnapshot> {
	const { packageManager, settingsManager } = createPluginContext(input);
	const configured = packageManager.listConfiguredPackages().filter((plugin) => input.workspacePath || plugin.scope === "user");
	const resolved = await packageManager.resolve(async () => "skip");
	return { plugins: await Promise.all(configured.map((plugin) => inspectPlugin(plugin, resolved, settingsManager))) };
}

export async function installPiPlugin(input: PluginAction): Promise<void> {
	const { packageManager, settingsManager } = createPluginContext(input);
	await packageManager.installAndPersist(requireSource(input.source), scopeOptions(input));
	await settingsManager.flush();
}

export async function updatePiPlugin(input: PluginAction): Promise<void> {
	const { packageManager } = createPluginContext(input);
	await packageManager.update(requireSource(input.source));
}

export async function removePiPlugin(input: PluginAction): Promise<void> {
	const { packageManager, settingsManager } = createPluginContext(input);
	await packageManager.removeAndPersist(requireSource(input.source), scopeOptions(input));
	await settingsManager.flush();
}

export async function setPiPluginEnabled(input: PluginAction & { enabled: boolean }): Promise<void> {
	const { settingsManager } = createPluginContext(input);
	const source = requireSource(input.source);
	const packages = configuredSources(settingsManager, input.scope);
	const index = packages.findIndex((entry) => packageSource(entry) === source);
	if (index === -1) throw new Error(`未配置 Pi 插件：${source}`);
	if (!isToggleable(packages[index])) throw new Error("此插件使用自定义资源筛选，不能通过开关修改。");

	const next = [...packages];
	next[index] = input.enabled ? source : { autoload: false, source };
	if (input.scope === "workspace") settingsManager.setProjectPackages(next);
	else settingsManager.setPackages(next);
	await settingsManager.flush();
}

async function inspectPlugin(plugin: ConfiguredPlugin, resolved: ResolvedPaths, settingsManager: SettingsManager): Promise<PiPlugin> {
	const scope = toPluginScope(plugin.scope);
	const source = configuredSources(settingsManager, scope).find((entry) => packageSource(entry) === plugin.source);
	return {
		enabled: !isCompletelyDisabled(source),
		installedPath: plugin.installedPath ?? null,
		installedVersion: await readInstalledVersion(plugin.installedPath),
		resources: collectResources(plugin.source, plugin.scope, resolved),
		scope,
		source: plugin.source,
		toggleable: !plugin.filtered || isCompletelyDisabled(source),
	};
}

function createPluginContext(input: PluginContext): ManagedPluginContext {
	const cwd = input.workspacePath ?? input.agentDir;
	const settingsManager = SettingsManager.create(cwd, input.agentDir, { projectTrusted: input.workspacePath !== undefined });
	return {
		...input,
		packageManager: new DefaultPackageManager({ agentDir: input.agentDir, cwd, settingsManager }),
		settingsManager,
	};
}

function scopeOptions(input: PluginAction): { local: boolean } | undefined {
	if (input.scope === "global") return undefined;
	if (!input.workspacePath) throw new Error("安装到工作区前，请先选择工作区。");
	return { local: true };
}

function configuredSources(settingsManager: SettingsManager, scope: PiPluginScope): PackageSource[] {
	return scope === "workspace" ? settingsManager.getProjectSettings().packages ?? [] : settingsManager.getGlobalSettings().packages ?? [];
}

function collectResources(source: string, scope: ConfiguredPlugin["scope"], resolved: ResolvedPaths): PiPluginResource[] {
	return RESOURCE_KINDS.flatMap((resourceType) => resolved[resourceType]
		.filter((resource) => resource.metadata.scope === scope && resource.metadata.source === source)
		.map((resource) => ({
			enabled: resource.enabled,
			kind: resourceKind(resourceType),
			name: resourceName(resource.path, resourceType),
			path: resource.path,
		})));
}

function toPluginScope(scope: ConfiguredPlugin["scope"]): PiPluginScope {
	return scope === "project" ? "workspace" : "global";
}

function resourceKind(resourceType: typeof RESOURCE_KINDS[number]): PiPluginResource["kind"] {
	if (resourceType === "extensions") return "extension";
	if (resourceType === "skills") return "skill";
	return "prompt";
}

function resourceName(path: string, resourceType: typeof RESOURCE_KINDS[number]): string {
	if (resourceType === "skills") return basename(dirname(path));
	const extension = extname(path);
	return extension ? basename(path, extension) : basename(path);
}

async function readInstalledVersion(installedPath: string | undefined): Promise<string | null> {
	if (!installedPath) return null;
	try {
		const manifest = await Bun.file(join(installedPath, "package.json")).json() as { version?: unknown };
		return typeof manifest.version === "string" ? manifest.version : null;
	} catch {
		return null;
	}
}

function packageSource(entry: PackageSource): string {
	return typeof entry === "string" ? entry : entry.source;
}

function isCompletelyDisabled(entry: PackageSource | undefined): boolean {
	return typeof entry === "object" && entry.autoload === false && RESOURCE_KINDS.every((kind) => entry[kind] === undefined);
}

function isToggleable(entry: PackageSource): boolean {
	return typeof entry === "string" || isCompletelyDisabled(entry);
}

function requireSource(value: string): string {
	const source = value.trim();
	if (!source) throw new Error("插件来源不能为空。");
	return source;
}
