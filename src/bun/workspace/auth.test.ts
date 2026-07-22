import { expect, test } from "bun:test";
import type { AuthInteraction } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { PiAuthenticationController } from "./auth";

test("OAuth 提供商未连接时仍可通过选择提示完成登录", async () => {
	const controller = new PiAuthenticationController();
	const events: Array<{
		inputType: string | null;
		options: Array<{ id: string; label: string }>;
		promptId: string | null;
	}> = [];
	controller.setEventHandler((event) => events.push(event));

	let selectedMethod: string | undefined;
	const modelRuntime = {
		getProvider: () => ({ auth: { oauth: { login: async () => ({}) } } }),
		login: async (_provider: string, method: string, interaction: AuthInteraction) => {
			selectedMethod = method;
			const choice = await interaction.prompt({
				type: "select",
				message: "选择登录方式",
				options: [{ id: "browser", label: "浏览器登录" }],
			});
			expect(choice).toBe("browser");
		},
	} as unknown as ModelRuntime;

	const login = controller.loginProvider({
		authType: "oauth",
		provider: "test-oauth",
	}, modelRuntime);
	await Promise.resolve();
	await Promise.resolve();

	const prompt = events[0];
	expect(selectedMethod).toBe("oauth");
	expect(prompt).toMatchObject({
		inputType: "select",
		options: [{ id: "browser", label: "浏览器登录" }],
	});
	expect(prompt.promptId).not.toBeNull();
	controller.respondPrompt({ id: prompt.promptId!, value: "browser" });
	await login;
});

test("取消登录会中止提供商交互", async () => {
	const controller = new PiAuthenticationController();
	let signal: AbortSignal | undefined;
	const modelRuntime = {
		getProvider: () => ({ auth: { oauth: { login: async () => ({}) } } }),
		login: async (_provider: string, _method: string, interaction: AuthInteraction) => {
			signal = interaction.signal;
			await new Promise<void>((_resolve, reject) => {
				interaction.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
			});
		},
	} as unknown as ModelRuntime;

	const login = controller.loginProvider({
		authType: "oauth",
		provider: "test-oauth",
	}, modelRuntime);
	await Promise.resolve();
	await Promise.resolve();

	controller.cancelProviderLogin("test-oauth");
	expect(signal?.aborted).toBe(true);
	await expect(login).rejects.toThrow("aborted");
});
