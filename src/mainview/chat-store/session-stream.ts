import type {
	PiOpenedSession,
	PiSessionEvent,
	PiToolPermissionRequest,
} from "@shared/pi-contract";
import type {
	ChatSessionSnapshot,
	ChatToolCall,
	ChatToolExecutionStatus,
} from "./types";
import { withRuntime } from "./utils";

const EMPTY_TOOLS: readonly ChatToolCall[] = [];
const EMPTY_PERMISSIONS: readonly PiToolPermissionRequest[] = [];
const MAX_PENDING_INPUTS = 500;

export type SessionStreamPatch = Partial<Pick<
	ChatSessionSnapshot,
	| "openedSession"
	| "error"
	| "pendingUserMessage"
	| "streamedText"
	| "thinkingText"
	| "tools"
	| "permissionRequests"
>>;

export type PendingSessionInput =
	| { kind: "event"; value: PiSessionEvent }
	| { kind: "permission"; value: PiToolPermissionRequest };

export type SessionStreamTransition = {
	patch?: SessionStreamPatch;
	refreshTranscript?: boolean;
};

export class SessionStream {
	private readonly toolsById = new Map<string, ChatToolCall>();
	private readonly pendingInputs: PendingSessionInput[] = [];
	private permissionRequests: readonly PiToolPermissionRequest[] = EMPTY_PERMISSIONS;
	private pendingUserMessage: string | null = null;
	private streamedText = "";
	private thinkingText = "";
	private revision = 0;
	private generation = 0;
	private settleGeneration: number | null = null;

	public get eventRevision(): number {
		return this.revision;
	}

	public get streamGeneration(): number {
		return this.generation;
	}

	public beginPrompt(openedSession: PiOpenedSession, message: string): SessionStreamPatch {
		this.generation += 1;
		this.settleGeneration = null;
		this.pendingUserMessage = message;
		this.resetCurrentOutput();
		return {
			error: null,
			openedSession: withRuntime(openedSession, { isStreaming: true }),
			pendingUserMessage: this.pendingUserMessage,
			streamedText: this.streamedText,
			thinkingText: this.thinkingText,
			tools: EMPTY_TOOLS,
			permissionRequests: this.permissionRequests,
		};
	}

	public failPrompt(openedSession: PiOpenedSession): SessionStreamPatch {
		this.pendingUserMessage = null;
		return {
			openedSession: withRuntime(openedSession, { isStreaming: false }),
			pendingUserMessage: null,
		};
	}

	public acceptEvent(
		event: PiSessionEvent,
		openedSession: PiOpenedSession,
	): SessionStreamTransition {
		this.revision += 1;
		switch (event.type) {
			case "agent_start":
				this.generation += 1;
				this.settleGeneration = null;
				this.resetCurrentOutput();
				return {
					patch: {
						error: null,
						openedSession: withRuntime(openedSession, { isStreaming: true }),
						streamedText: this.streamedText,
						thinkingText: this.thinkingText,
						tools: EMPTY_TOOLS,
						permissionRequests: this.permissionRequests,
					},
				};
			case "text_delta":
				this.streamedText += event.delta;
				return {
					patch: {
						openedSession: withRuntime(openedSession, { isStreaming: true }),
						streamedText: this.streamedText,
					},
				};
			case "thinking_delta":
				this.thinkingText += event.delta;
				return {
					patch: {
						openedSession: withRuntime(openedSession, { isStreaming: true }),
						thinkingText: this.thinkingText,
					},
				};
			case "tool_execution_start":
				return { patch: this.updateTool(event.toolCallId, event.toolName, "running", null) };
			case "tool_execution_end":
				return {
					patch: this.updateTool(
						event.toolCallId,
						event.toolName,
						"completed",
						event.isError,
					),
				};
			case "error":
				this.pendingUserMessage = null;
				return {
					patch: {
						error: event.errorMessage,
						openedSession: withRuntime(openedSession, { isStreaming: false }),
						pendingUserMessage: null,
					},
				};
			case "agent_settled":
				this.settleGeneration = this.generation;
				this.pendingUserMessage = null;
				this.permissionRequests = EMPTY_PERMISSIONS;
				return {
					patch: {
						openedSession: withRuntime(openedSession, { isStreaming: false }),
						pendingUserMessage: null,
						permissionRequests: EMPTY_PERMISSIONS,
					},
					refreshTranscript: true,
				};
		}
	}

	public acceptPermission(request: PiToolPermissionRequest): SessionStreamPatch | undefined {
		if (this.permissionRequests.some((candidate) => candidate.id === request.id)) return;
		this.permissionRequests = [...this.permissionRequests, request];
		const patch: SessionStreamPatch = { permissionRequests: this.permissionRequests };
		if (request.toolCallId) {
			Object.assign(
				patch,
				this.updateTool(request.toolCallId, request.toolName, "awaiting_permission", null),
			);
		}
		return patch;
	}

	public resolvePermission(
		request: PiToolPermissionRequest,
		allowed: boolean,
	): SessionStreamPatch {
		this.permissionRequests = this.permissionRequests.filter(
			(candidate) => candidate.id !== request.id,
		);
		const patch: SessionStreamPatch = {
			error: null,
			permissionRequests: this.permissionRequests,
		};
		if (!allowed && request.toolCallId) {
			Object.assign(patch, this.markDeniedTool(request.toolCallId, request.toolName));
		}
		return patch;
	}

	public completeRefresh(requestGeneration: number): SessionStreamPatch | undefined {
		if (this.settleGeneration !== requestGeneration || this.generation !== requestGeneration) {
			return;
		}
		this.settleGeneration = null;
		this.pendingUserMessage = null;
		this.resetCurrentOutput();
		return {
			pendingUserMessage: null,
			streamedText: this.streamedText,
			thinkingText: this.thinkingText,
			tools: EMPTY_TOOLS,
			permissionRequests: this.permissionRequests,
		};
	}

	public enqueue(input: PendingSessionInput): void {
		this.pendingInputs.push(input);
		if (this.pendingInputs.length > MAX_PENDING_INPUTS) this.pendingInputs.shift();
	}

	public takePendingInputs(): PendingSessionInput[] {
		return this.pendingInputs.splice(0);
	}

	public dispose(): void {
		this.toolsById.clear();
		this.pendingInputs.length = 0;
		this.permissionRequests = EMPTY_PERMISSIONS;
	}

	private updateTool(
		id: string,
		name: string,
		executionStatus: ChatToolExecutionStatus,
		isError: boolean | null,
	): SessionStreamPatch {
		const previous = this.toolsById.get(id);
		this.toolsById.set(id, {
			id,
			name,
			input: previous?.input ?? {},
			output: previous?.output ?? null,
			isError: isError ?? previous?.isError ?? null,
			executionStatus,
		});
		return { tools: [...this.toolsById.values()] };
	}

	private markDeniedTool(id: string, name: string): SessionStreamPatch {
		const previous = this.toolsById.get(id);
		this.toolsById.set(id, {
			id,
			name,
			input: previous?.input ?? {},
			output: "用户拒绝执行此工具调用。",
			isError: true,
			executionStatus: "completed",
		});
		return { tools: [...this.toolsById.values()] };
	}

	private resetCurrentOutput(): void {
		this.streamedText = "";
		this.thinkingText = "";
		this.toolsById.clear();
		this.permissionRequests = EMPTY_PERMISSIONS;
	}
}
