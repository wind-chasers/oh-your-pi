import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

export type PiSessionEvent =
	| { sessionPath: string; type: "assistant-text-delta"; text: string }
	| { sessionPath: string; type: "assistant-thinking-delta"; text: string }
	| { sessionPath: string; type: "tool-start"; toolCallId: string; toolName: string }
	| { sessionPath: string; type: "tool-update"; toolCallId: string; toolName: string }
	| { sessionPath: string; type: "tool-end"; toolCallId: string; toolName: string; isError: boolean }
	| { sessionPath: string; type: "agent-start" }
	| { sessionPath: string; type: "message-end" }
	| { sessionPath: string; type: "agent-end" }
	| { sessionPath: string; type: "agent-settled" }
	| { sessionPath: string; type: "error"; error: Error };

export function toPiSessionEvents(sessionPath: string, event: AgentSessionEvent): PiSessionEvent[] {
	if (event.type === "message_update") {
		if (event.assistantMessageEvent.type === "text_delta") {
			return [{ sessionPath, type: "assistant-text-delta", text: event.assistantMessageEvent.delta }];
		}
		if (event.assistantMessageEvent.type === "thinking_delta") {
			return [{ sessionPath, type: "assistant-thinking-delta", text: event.assistantMessageEvent.delta }];
		}
		return [];
	}
	if (event.type === "tool_execution_start") {
		return [{ sessionPath, type: "tool-start", toolCallId: event.toolCallId, toolName: event.toolName }];
	}
	if (event.type === "tool_execution_update") {
		return [{ sessionPath, type: "tool-update", toolCallId: event.toolCallId, toolName: event.toolName }];
	}
	if (event.type === "tool_execution_end") {
		return [{
			sessionPath,
			type: "tool-end",
			toolCallId: event.toolCallId,
			toolName: event.toolName,
			isError: event.isError,
		}];
	}
	if (event.type === "agent_start") return [{ sessionPath, type: "agent-start" }];
	if (event.type === "message_end") return [{ sessionPath, type: "message-end" }];
	if (event.type === "agent_settled") return [{ sessionPath, type: "agent-settled" }];
	if (event.type !== "agent_end") return [];

	const events: PiSessionEvent[] = [];
	if (!event.willRetry) {
		for (const message of event.messages) {
			if (message.role !== "assistant" || message.stopReason !== "error" || !message.errorMessage) continue;
			events.push({ sessionPath, type: "error", error: new Error(message.errorMessage) });
		}
	}
	events.push({ sessionPath, type: "agent-end" });
	return events;
}
