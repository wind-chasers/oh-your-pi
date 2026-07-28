import type {
	PiToolPermissionRequest,
	PiToolPermissionResolution,
	PiToolPermissionResponse,
} from "@shared/pi-contract";
import type { PiToolCall, PiToolCallDecision } from "@main/pi";
import { redactSensitiveText } from "@main/utils/redact-sensitive-text";

type PermissionListener = (request: PiToolPermissionRequest) => void;

type PendingPermission = {
	resolve(allowed: boolean): void;
	sessionPath: string;
};

export class ToolPermissionApplication {
	private readonly listeners = new Set<PermissionListener>();
	private readonly pending = new Map<string, PendingPermission>();

	async beforeToolCall(call: PiToolCall): Promise<PiToolCallDecision> {
		if (!requiresToolPermission(call.toolName)) return { allowed: true };
		const isDangerous = isDangerousToolCall(call.toolName, call.input);
		const allowed = await this.request({
			isDangerous,
			message: `${summarizeToolInput(call.input)}\n\nPi 将以当前用户权限执行此操作。`,
			sessionPath: call.sessionPath,
			title: isDangerous ? "检测到危险操作" : "请求工具授权",
			toolCallId: call.toolCallId,
			toolName: call.toolName,
		});
		if (!allowed) {
			return { allowed: false, reason: "用户拒绝了 Oh Your Pi 工具授权。" };
		}
		return { allowed: true };
	}

	respond(input: PiToolPermissionResponse): PiToolPermissionResolution {
		const pending = this.pending.get(input.id);
		if (!pending) throw new Error("该工具授权请求已失效。");
		this.pending.delete(input.id);
		pending.resolve(input.allowed);
		return { resolved: true };
	}

	subscribe(listener: PermissionListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	resetSession(sessionPath: string): void {
		for (const [id, pending] of this.pending) {
			if (pending.sessionPath !== sessionPath) continue;
			this.pending.delete(id);
			pending.resolve(false);
		}
	}

	dispose(): void {
		for (const pending of this.pending.values()) pending.resolve(false);
		this.pending.clear();
		this.listeners.clear();
	}

	private request(input: Omit<PiToolPermissionRequest, "id">): Promise<boolean> {
		if (this.listeners.size === 0) return Promise.resolve(false);
		const request = {
			...input,
			id: crypto.randomUUID(),
			message: redactSensitiveText(input.message),
		};
		const { promise, resolve } = Promise.withResolvers<boolean>();
		this.pending.set(request.id, { resolve, sessionPath: request.sessionPath });
		for (const listener of this.listeners) listener(request);
		return promise;
	}
}

function requiresToolPermission(toolName: string): boolean {
	return !["read", "grep", "find", "ls"].includes(toolName);
}

function isDangerousToolCall(toolName: string, input: Record<string, unknown>): boolean {
	if (toolName !== "bash") return false;
	const command = typeof input.command === "string" ? input.command : "";
	return /\b(rm\s+-[^\n]*r|sudo\b|chmod\b|chown\b|mkfs\b|diskutil\s+erase|git\s+(reset\s+--hard|clean\b)|npm\s+publish|brew\s+uninstall)\b|(^|\s)>\s*[^&]/.test(command);
}

function summarizeToolInput(input: Record<string, unknown>): string {
	try {
		return redactSensitiveText(JSON.stringify(input, null, 2)).slice(0, 1_500);
	} catch {
		return "工具参数无法序列化。";
	}
}
