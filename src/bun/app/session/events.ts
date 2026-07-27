import type { PiSessionEvent as AppSessionEvent } from "@shared/pi-contract";
import type { PiSessionEvent } from "@main/pi";

export function toAppSessionEvent(event: PiSessionEvent): AppSessionEvent {
	switch (event.type) {
		case "assistant-text-delta":
			return createEvent(event.sessionPath, "assistant_text_delta", { text: event.text });
		case "assistant-thinking-delta":
			return createEvent(event.sessionPath, "assistant_thinking_delta", { text: event.text });
		case "tool-start":
			return createEvent(event.sessionPath, "tool_start", event);
		case "tool-update":
			return createEvent(event.sessionPath, "tool_update", event);
		case "tool-end":
			return createEvent(event.sessionPath, "tool_end", event);
		case "agent-start":
			return createEvent(event.sessionPath, "agent_start");
		case "message-end":
			return createEvent(event.sessionPath, "message_end");
		case "agent-end":
			return createEvent(event.sessionPath, "agent_end");
		case "agent-settled":
			return createEvent(event.sessionPath, "agent_settled");
		case "error":
			return createEvent(event.sessionPath, "error", { text: event.error.message });
	}
}

function createEvent(
	sessionPath: string,
	type: AppSessionEvent["type"],
	details: Partial<Pick<AppSessionEvent, "text" | "toolCallId" | "toolName" | "isError">> = {},
): AppSessionEvent {
	return {
		sessionPath,
		type,
		text: details.text ?? null,
		toolCallId: details.toolCallId ?? null,
		toolName: details.toolName ?? null,
		isError: details.isError ?? null,
	};
}
