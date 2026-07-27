import type {
	CreateAgentSessionServicesOptions,
	ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

type ExtensionFactory = NonNullable<
	NonNullable<CreateAgentSessionServicesOptions["resourceLoaderOptions"]>["extensionFactories"]
>[number];

export type PiToolCall = {
	sessionPath: string;
	toolCallId: string;
	toolName: string;
	input: Record<string, unknown>;
};

export type PiToolCallDecision = {
	allowed: boolean;
	reason?: string;
};

export type PiSessionHooks = {
	beforeToolCall?(call: PiToolCall): Promise<PiToolCallDecision>;
};

export function createSessionExtensionFactories(
	hooks: PiSessionHooks,
	getSessionPath: () => string | undefined,
): ExtensionFactory[] {
	if (!hooks.beforeToolCall) return [];
	return [{
		name: "oh-your-pi-session-hooks",
		factory: (pi: ExtensionAPI) => {
			pi.on("tool_call", async (event) => {
				const sessionPath = getSessionPath();
				if (!sessionPath || !hooks.beforeToolCall) {
					return { block: true, reason: "Pi 会话尚未准备完成。" };
				}
				const decision = await hooks.beforeToolCall({
					sessionPath,
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					input: event.input,
				});
				if (!decision.allowed) return { block: true, reason: decision.reason ?? "用户拒绝了工具授权。" };
			});
		},
	}];
}
