import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { PiWorkspaceService } from "@main/workspace/service";

describe("PiWorkspaceService", () => {
	test("从 Pi SDK 读取工作区且不将凭据传出 DTO", async () => {
		const workspacePath = resolve(import.meta.dir, "../../..");
		const snapshot = await new PiWorkspaceService().inspect({ workspacePath });
		expect(snapshot.workspacePath).toBe(workspacePath);
		expect(Array.isArray(snapshot.sessions)).toBe(true);
		expect(Array.isArray(snapshot.resources.extensionDetails)).toBe(true);
		expect(snapshot.authentication.every((provider) => Object.keys(provider).every((key) => ["provider", "name", "status", "type", "loginMethods"].includes(key)))).toBe(true);
	});

	test("认证提供商可在未选择工作区时读取", async () => {
		const authentication = await new PiWorkspaceService().inspectAuthentication();
		expect(Array.isArray(authentication)).toBe(true);
		expect(authentication.every((provider) => Object.keys(provider).every((key) => ["provider", "name", "status", "type", "loginMethods"].includes(key)))).toBe(true);
	});
});
