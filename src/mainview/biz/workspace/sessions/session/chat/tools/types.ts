import type { ComponentType } from "react";
import type {
	ChatToolCall,
	ChatToolExecutionStatus,
	SessionViewToolCall,
} from "@view/chat-store";

export type ToolCallExecutionStatus = ChatToolExecutionStatus | "interrupted";
export type ToolCallItem = ChatToolCall | SessionViewToolCall;

export type ToolSlotProps = {
	toolCall: ToolCallItem;
	executionStatus: ToolCallExecutionStatus;
};

export type ToolChipSlotProps = ToolSlotProps & {
	onClick: () => void;
	selected: boolean;
};

export type ToolRenderer = {
	getLabel?: (toolCall: ToolCallItem) => string;
	Chip?: ComponentType<ToolChipSlotProps>;
	getInputText?: (toolCall: ToolCallItem) => string;
	Input?: ComponentType<ToolSlotProps>;
	getOutputText?: (toolCall: ToolCallItem) => string;
	Output?: ComponentType<ToolSlotProps>;
};
