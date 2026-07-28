import { expect, mock, test } from "bun:test";
import type { Application } from "@main/app";
import type { DesktopSystem } from "@main/desktop/system";

let requestHandlers: Record<string, (input: never) => unknown> | undefined;

mock.module("electrobun/bun", () => ({
	BrowserView: {
		defineRPC: (options: { handlers: { requests: Record<string, (input: never) => unknown> } }) => {
			requestHandlers = options.handlers.requests;
			return { send: { authenticationEvent: () => {}, sessionEvent: () => {}, toolPermissionRequest: () => {} } };
		},
	},
}));

const { createPiRpc } = await import(".");

function createTestApp(overrides: {
	cancel?: (input: { provider: string }) => void;
	list?: () => unknown;
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
		},
	} as unknown as Application;
}

const desktop = {
	chooseImageFiles: async () => [],
	chooseWorkspaceDirectory: async () => null,
	openExternalUrl: () => {},
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
