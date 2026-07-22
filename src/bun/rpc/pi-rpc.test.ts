import { expect, mock, test } from "bun:test";
import type { PiWorkspaceService } from "@main/workspace/service";

let requestHandlers: Record<string, (input: unknown) => unknown> | undefined;

mock.module("electrobun/bun", () => ({
	BrowserView: {
		defineRPC: (options: { handlers: { requests: Record<string, (input: unknown) => unknown> } }) => {
			requestHandlers = options.handlers.requests;
			return { send: { authenticationEvent: () => {}, sessionEvent: () => {}, toolPermissionRequest: () => {} } };
		},
	},
	Utils: { openExternal: () => {}, openFileDialog: async () => [] },
}));

const { createPiRpc } = await import("./pi-rpc");

test("认证取消请求被注册并转发给工作区服务", () => {
	const cancelProviderLogin = mock(() => undefined);
	const workspaceService = {
		cancelProviderLogin,
		setAuthenticationEventHandler: () => {},
		setEventHandler: () => {},
		setPermissionHandler: () => {},
	} as unknown as PiWorkspaceService;

	createPiRpc(workspaceService);
	requestHandlers?.cancelProviderLogin({ provider: "anthropic" });

	expect(cancelProviderLogin).toHaveBeenCalledWith({ provider: "anthropic" });
});

test("认证提供商检查不要求工作区参数", () => {
	const inspectAuthentication = mock(() => []);
	const workspaceService = {
		inspectAuthentication,
		setAuthenticationEventHandler: () => {},
		setEventHandler: () => {},
		setPermissionHandler: () => {},
	} as unknown as PiWorkspaceService;

	createPiRpc(workspaceService);
	requestHandlers?.inspectAuthentication({});

	expect(inspectAuthentication).toHaveBeenCalledWith();
});
