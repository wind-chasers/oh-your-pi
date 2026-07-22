import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	PiToolPermissionResponseSchema,
	type PiToolPermissionRequest,
	type PiToolPermissionResolution,
	type PiToolPermissionResponse,
} from "@shared/pi-contract";
import { redactSensitiveText } from "@main/pi/redaction";

type PermissionHandler = (request: PiToolPermissionRequest) => void;

export class ToolPermissionGateway {
	private handler: PermissionHandler | undefined;
	private pending = new Map<string, { resolve: (allowed: boolean) => void; sessionPath: string }>();

	setHandler(handler: PermissionHandler): void {
		this.handler = handler;
	}

	respond(input: PiToolPermissionResponse): PiToolPermissionResolution {
		const request = PiToolPermissionResponseSchema.parse(input);
		const pending = this.pending.get(request.id);
		if (!pending) throw new Error("该工具授权请求已失效。");
		this.pending.delete(request.id);
		pending.resolve(request.allowed);
		return { resolved: true };
	}

	reset(): void {
		for (const pending of this.pending.values()) pending.resolve(false);
		this.pending.clear();
	}

	resetSession(sessionPath: string): void {
		for (const [id, pending] of this.pending) {
			if (pending.sessionPath !== sessionPath) continue;
			this.pending.delete(id);
			pending.resolve(false);
		}
	}

	createExtension(getSessionPath: () => string | undefined) {
		return {
			name: "oh-your-pi-tool-permissions",
			factory: (pi: ExtensionAPI) => {
				pi.on("tool_call", async (event) => {
					if (!requiresToolPermission(event.toolName)) return;
					const isDangerous = isDangerousToolCall(event.toolName, event.input);
					const allowed = await this.request(
						{
							isDangerous,
							message: `${summarizeToolInput(event.input)}\n\nPi 将以当前用户权限执行此操作。`,
							title: isDangerous ? "检测到危险操作" : "请求工具授权",
							toolCallId: event.toolCallId,
							toolName: event.toolName,
						},
						getSessionPath(),
					);
					if (!allowed) return { block: true, reason: "用户拒绝了 Oh Your Pi 工具授权。" };
				});
			},
		};
	}

	private request(
		input: Omit<PiToolPermissionRequest, "id" | "sessionPath">,
		sessionPath: string | undefined,
	): Promise<boolean> {
		if (!sessionPath || !this.handler) return Promise.resolve(false);
		const request = {
			...input,
			id: crypto.randomUUID(),
			sessionPath,
			message: redactSensitiveText(input.message),
		};
		const { promise, resolve } = Promise.withResolvers<boolean>();
		this.pending.set(request.id, { resolve, sessionPath });
		this.handler?.(request);
		return promise;
	}
}

function requiresToolPermission(toolName: string): boolean {
	return !["read", "grep", "find", "ls"].includes(toolName);
}

function isDangerousToolCall(toolName: string, input: Record<string, unknown>): boolean {
	if (toolName !== "bash") return false;
	const command = typeof input.command === "string" ? input.command : "";
	return /\b(rm\s+-[^\n]*r|sudo\b|chmod\b|chown\b|mkfs\b|diskutil\s+erase|git\s+(reset\s+--hard|clean\b)|npm\s+publish|brew\s+uninstall)\b|(^|\s)>\s*[^&]/.test(
		command,
	);
}

function summarizeToolInput(input: Record<string, unknown>): string {
	try {
		return redactSensitiveText(JSON.stringify(input, null, 2)).slice(0, 1_500);
	} catch {
		return "工具参数无法序列化。";
	}
}
