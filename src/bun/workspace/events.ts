import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { PiSessionEventSchema, type PiSessionEvent } from "@shared/pi-contract";

type SessionEventRelayOptions = {
	onAgentError: (sessionPath: string, error: Error) => boolean;
	onAgentSettled: (sessionPath: string) => boolean;
};

export class PiSessionEventRelay {
	private eventHandler: ((event: PiSessionEvent) => void) | undefined;

	constructor(private readonly options: SessionEventRelayOptions) {}

	setEventHandler(eventHandler: (event: PiSessionEvent) => void): void {
		this.eventHandler = eventHandler;
	}

	dispatch(sessionPath: string, event: AgentSessionEvent): void {
		if (event.type === "message_update") {
			if (event.assistantMessageEvent.type === "text_delta")
				this.emit({ sessionPath, type: "assistant_text_delta", text: event.assistantMessageEvent.delta });
			if (event.assistantMessageEvent.type === "thinking_delta")
				this.emit({ sessionPath, type: "assistant_thinking_delta", text: event.assistantMessageEvent.delta });
			return;
		}
		if (event.type === "tool_execution_start")
			return this.emit({ sessionPath, type: "tool_start", toolCallId: event.toolCallId, toolName: event.toolName });
		if (event.type === "tool_execution_update")
			return this.emit({ sessionPath, type: "tool_update", toolCallId: event.toolCallId, toolName: event.toolName });
		if (event.type === "tool_execution_end")
			return this.emit({
				sessionPath,
				type: "tool_end",
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				isError: event.isError,
			});
		if (event.type === "agent_start") return this.emit({ sessionPath, type: "agent_start" });
		if (event.type === "message_end") return this.emit({ sessionPath, type: "message_end" });
		if (event.type === "agent_settled") {
			if (!this.options.onAgentSettled(sessionPath)) this.emit({ sessionPath, type: "agent_settled" });
			return;
		}
		if (event.type !== "agent_end") return;
		if (!event.willRetry) {
			for (const message of event.messages) {
				if (message.role !== "assistant" || message.stopReason !== "error" || !message.errorMessage) continue;
				if (!this.options.onAgentError(sessionPath, new Error(message.errorMessage)))
					this.emit({ sessionPath, type: "error", text: message.errorMessage });
			}
		}
		this.emit({ sessionPath, type: "agent_end" });
	}

	emitError(sessionPath: string, error: unknown): void {
		this.emit({ sessionPath, type: "error", text: error instanceof Error ? error.message : "Pi 会话运行失败。" });
	}

	private emit(
		event: Omit<PiSessionEvent, "toolCallId" | "toolName" | "isError" | "text"> & Partial<PiSessionEvent>,
	): void {
		this.eventHandler?.(
			PiSessionEventSchema.parse({ text: null, toolCallId: null, toolName: null, isError: null, ...event }),
		);
	}
}
