import type { PiSessionEvent as AppSessionEvent } from "@shared/pi-contract";
import type { PiSessionEvent } from "@main/pi";

export function toAppSessionEvents(
	sessionPath: string,
	event: PiSessionEvent,
): AppSessionEvent[] {
	if (event.type === "error") {
		return [{ sessionPath, type: "error", errorMessage: event.error.message }];
	}
	if (event.type === "message_update") {
		if (event.assistantMessageEvent.type === "text_delta") {
			return [{ sessionPath, type: "text_delta", delta: event.assistantMessageEvent.delta }];
		}
		if (event.assistantMessageEvent.type === "thinking_delta") {
			return [{ sessionPath, type: "thinking_delta", delta: event.assistantMessageEvent.delta }];
		}
		return [];
	}
	if (event.type === "tool_execution_start") {
		return [{
			sessionPath,
			type: event.type,
			toolCallId: event.toolCallId,
			toolName: event.toolName,
		}];
	}
	if (event.type === "tool_execution_end") {
		return [{
			sessionPath,
			type: event.type,
			toolCallId: event.toolCallId,
			toolName: event.toolName,
			isError: event.isError,
		}];
	}
	if (event.type === "agent_start" || event.type === "agent_settled") {
		return [{ sessionPath, type: event.type }];
	}
	if (event.type !== "agent_end" || event.willRetry) return [];

	return event.messages.flatMap((message) => {
		if (message.role !== "assistant" || message.stopReason !== "error" || !message.errorMessage) {
			return [];
		}
		return [{ sessionPath, type: "error" as const, errorMessage: message.errorMessage }];
	});
}
