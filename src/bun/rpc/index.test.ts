import { expect, mock, test } from "bun:test";
import type { Application } from "@main/app";
import type { DesktopSystem } from "@main/desktop/system";

let requestHandlers: Record<string, (input: never) => unknown> | undefined;
const openAppSettings = mock(() => undefined);

mock.module("electrobun/bun", () => ({
	BrowserView: {
		defineRPC: (options: { handlers: { requests: Record<string, (input: never) => unknown> } }) => {
			requestHandlers = options.handlers.requests;
			return { send: { authenticationEvent: () => {}, openAppSettings, sessionEvent: () => {}, toolPermissionRequest: () => {} } };
		},
	},
}));

const { createPiRpc } = await import(".");

function createTestApp(overrides: {
	cancel?: (input: { provider: string }) => void;
	list?: () => unknown;
	regenerate?: (input: { sessionPath: string; entryId: string; text: string }) => unknown;
}): Application {
	return {
		authentication: {
			cancel: overrides.cancel ?? (() => {}),
			list: overrides.list ?? (async () => []),
			subscribe: () => () => {},
		},
		session: {
			subscribe: () => () => {},
			subscribePermissions: () => () => {},
			regenerate: overrides.regenerate ?? (() => {}),
		},
	} as unknown as Application;
}

const desktop = {
	chooseImageFiles: async () => [],
	chooseWorkspaceDirectory: async () => null,
	openExternalUrl: () => {},
	openWorkspaceFolder: () => {},
} satisfies DesktopSystem;

test("认证取消请求被注册并转发给认证业务", () => {
	const cancel = mock(() => undefined);
	createPiRpc({ app: createTestApp({ cancel }), desktop });
	requestHandlers?.cancelProviderLogin({ provider: "anthropic" } as never);
	expect(cancel).toHaveBeenCalledWith({ provider: "anthropic" });
});

test("认证提供商检查不要求工作区参数", () => {
	const list = mock(() => []);
	createPiRpc({ app: createTestApp({ list }), desktop });
	requestHandlers?.inspectAuthentication({} as never);
	expect(list).toHaveBeenCalledWith();
});

test("历史消息重新生成请求被转发给会话业务", () => {
	const regenerate = mock(() => undefined);
	createPiRpc({ app: createTestApp({ regenerate }), desktop });
	const input = { sessionPath: "/tmp/session.jsonl", entryId: "entry-1", text: "修改后" };
	requestHandlers?.regenerateSessionMessage(input as never);
	expect(regenerate).toHaveBeenCalledWith(input);
});

test("工作区文件夹打开请求被转发给桌面服务", () => {
	const openWorkspaceFolder = mock(() => undefined);
	createPiRpc({
		app: createTestApp({}),
		desktop: { ...desktop, openWorkspaceFolder },
	});
	requestHandlers?.openWorkspaceFolder({ workspacePath: "/tmp/workspace" } as never);
	expect(openWorkspaceFolder).toHaveBeenCalledWith("/tmp/workspace");
});

test("设置菜单命令被发送给 Renderer", () => {
	const binding = createPiRpc({ app: createTestApp({}), desktop });
	binding.openAppSettings();
	expect(openAppSettings).toHaveBeenCalledWith({});
});
