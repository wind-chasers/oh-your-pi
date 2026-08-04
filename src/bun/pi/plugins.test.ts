import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	inspectPiPlugins,
	installPiPlugin,
	setPiPluginEnabled,
} from "./plugins";

let root = "";
let agentDir = "";
let pluginPath = "";
let workspacePath = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "oh-your-pi-plugins-"));
	agentDir = join(root, "agent");
	pluginPath = join(root, "example-plugin");
	workspacePath = join(root, "workspace");
	await Promise.all([
		mkdir(agentDir, { recursive: true }),
		mkdir(join(pluginPath, "skills", "example"), { recursive: true }),
		mkdir(join(pluginPath, "prompts"), { recursive: true }),
		mkdir(workspacePath, { recursive: true }),
	]);
	await Promise.all([
		writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [pluginPath] })),
		writeFile(join(pluginPath, "index.ts"), "export default () => {};\n"),
		writeFile(join(pluginPath, "skills", "example", "SKILL.md"), "---\nname: example\ndescription: Example\n---\n"),
		writeFile(join(pluginPath, "prompts", "example.md"), "Example prompt\n"),
		writeFile(join(pluginPath, "package.json"), JSON.stringify({
			name: "example-plugin",
			pi: {
				extensions: ["./index.ts"],
				prompts: ["./prompts"],
				skills: ["./skills"],
			},
			version: "1.2.3",
		})),
	]);
});

afterEach(async () => {
	await rm(root, { force: true, recursive: true });
});

describe("Pi plugins", () => {
	test("读取全局插件及其已解析资源", async () => {
		const snapshot = await inspectPiPlugins({ agentDir });

		expect(snapshot.plugins).toEqual([expect.objectContaining({
			enabled: true,
			installedPath: pluginPath,
			installedVersion: "1.2.3",
			resources: expect.arrayContaining([
				expect.objectContaining({ kind: "extension", name: "index" }),
				expect.objectContaining({ kind: "skill", name: "example" }),
				expect.objectContaining({ kind: "prompt", name: "example" }),
			]),
			source: pluginPath,
			toggleable: true,
		})]);
	});

	test("停用插件时保留安装并且可以重新启用", async () => {
		await setPiPluginEnabled({ agentDir, enabled: false, scope: "global", source: pluginPath });
		const disabled = await inspectPiPlugins({ agentDir });
		expect(disabled.plugins[0]).toMatchObject({
			enabled: false,
			installedPath: pluginPath,
			toggleable: true,
		});
		await setPiPluginEnabled({ agentDir, enabled: true, scope: "global", source: pluginPath });
		const enabled = await inspectPiPlugins({ agentDir });
		expect(enabled.plugins[0]).toMatchObject({ enabled: true, toggleable: true });
		expect(enabled.plugins[0]?.resources).toHaveLength(3);
	});

	test("安装到工作区时保留全局插件并返回工作区资源", async () => {
		await installPiPlugin({ agentDir, scope: "workspace", source: pluginPath, workspacePath });
		const snapshot = await inspectPiPlugins({ agentDir, workspacePath });
		expect(snapshot.plugins.filter((plugin) => plugin.scope === "global")).toHaveLength(1);
		expect(snapshot.plugins.filter((plugin) => plugin.scope === "workspace")).toEqual([
			expect.objectContaining({ installedPath: pluginPath, resources: expect.any(Array) }),
		]);
	});
});
