import { expect, test } from "bun:test";
import type { AuthInteraction, AuthType } from "@earendil-works/pi-ai";
import type { PiAuthentication } from "@main/pi";
import { AuthenticationApplication } from "@main/app/authentication";

test("OAuth 提供商未连接时仍可通过选择提示完成登录", async () => {
	let selectedMethod: AuthType | undefined;
	const authentication = {
		listProviders: async () => [],
		login: async (
			_provider: string,
			method: AuthType,
			interaction: AuthInteraction,
		) => {
			selectedMethod = method;
			const choice = await interaction.prompt({
				type: "select",
				message: "选择登录方式",
				options: [{ id: "browser", label: "浏览器登录" }],
			});
			expect(choice).toBe("browser");
		},
	} as unknown as PiAuthentication;
	const app = new AuthenticationApplication(authentication);
	const events: Array<{ inputType: string | null; options: Array<{ id: string; label: string }>; promptId: string | null }> = [];
	app.subscribe((event) => events.push(event));

	const login = app.login({ authType: "oauth", provider: "test-oauth" });
	await Promise.resolve();
	await Promise.resolve();

	const prompt = events[0];
	expect(selectedMethod).toBe("oauth");
	expect(prompt).toMatchObject({
		inputType: "select",
		options: [{ id: "browser", label: "浏览器登录" }],
	});
	expect(prompt.promptId).not.toBeNull();
	app.respond({ id: prompt.promptId!, value: "browser" });
	await login;
	app.dispose();
});

test("GitHub Copilot 的 Enterprise 域提示允许提交空值", async () => {
	const authentication = {
		listProviders: async () => [],
		login: async (
			_provider: string,
			_method: AuthType,
			interaction: AuthInteraction,
		) => {
			expect(await interaction.prompt({
				type: "text",
				message: "GitHub Enterprise URL/domain (blank for github.com)",
				placeholder: "company.ghe.com",
			})).toBe("");
		},
	} as unknown as PiAuthentication;
	const app = new AuthenticationApplication(authentication);
	const events: Array<{ allowsEmpty?: boolean; promptId: string | null }> = [];
	app.subscribe((event) => events.push(event));

	const login = app.login({ authType: "oauth", provider: "github-copilot" });
	await Promise.resolve();
	await Promise.resolve();

	expect(events[0]).toMatchObject({ allowsEmpty: true });
	app.respond({ id: events[0].promptId!, value: "" });
	await login;
	app.dispose();
});

test("取消登录会中止提供商交互", async () => {
	let signal: AbortSignal | undefined;
	const authentication = {
		listProviders: async () => [],
		login: async (
			_provider: string,
			_method: AuthType,
			interaction: AuthInteraction,
		) => {
			signal = interaction.signal;
			await new Promise<void>((_resolve, reject) => {
				interaction.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
			});
		},
	} as unknown as PiAuthentication;
	const app = new AuthenticationApplication(authentication);
	const login = app.login({ authType: "oauth", provider: "test-oauth" });
	await Promise.resolve();
	await Promise.resolve();

	app.cancel({ provider: "test-oauth" });
	expect(signal?.aborted).toBe(true);
	await expect(login).rejects.toThrow("aborted");
	app.dispose();
});
