import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { PiRuntime } from "@main/pi";
import { Application } from "@main/app";

describe("App", () => {
	test("从 Pi SDK 读取工作区且不将凭据传出 DTO", async () => {
		const pi = await PiRuntime.create();
		const app = new Application(pi);
		try {
			const workspacePath = resolve(import.meta.dir, "../../..");
			const snapshot = await app.inspectWorkspace({ workspacePath });
			expect(snapshot.workspacePath).toBe(workspacePath);
			expect(Array.isArray(snapshot.sessions)).toBe(true);
			expect(Array.isArray(snapshot.resources.extensionDetails)).toBe(true);
			expect(snapshot.authentication.every((provider) =>
				Object.keys(provider).every((key) => ["provider", "name", "status", "type", "loginMethods"].includes(key))
			)).toBe(true);
		} finally {
			await app.dispose();
			await pi.dispose();
		}
	});

	test("未选择工作区时仍可读取全局 Pi 插件", async () => {
		const pi = await PiRuntime.create();
		const app = new Application(pi);
		try {
			const plugins = await app.inspectPlugins({});
			expect(Array.isArray(plugins.plugins)).toBe(true);
		} finally {
			await app.dispose();
			await pi.dispose();
		}
	});

	test("认证提供商可在未选择工作区时读取", async () => {
		const pi = await PiRuntime.create();
		const app = new Application(pi);
		try {
			const authentication = await app.authentication.list();
			expect(Array.isArray(authentication)).toBe(true);
			expect(authentication.every((provider) =>
				Object.keys(provider).every((key) => ["provider", "name", "status", "type", "loginMethods"].includes(key))
			)).toBe(true);
		} finally {
			await app.dispose();
			await pi.dispose();
		}
	});
});
