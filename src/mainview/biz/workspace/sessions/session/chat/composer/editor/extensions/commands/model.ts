import type { TokenExtensionState } from "../shared/token";

export interface CommandDefinition {
	description: string;
	name: string;
}

export interface CommandExtensionState extends TokenExtensionState {
	activeIndex: number;
}

export type CommandPanelEvent =
	| { type: "hover"; index: number }
	| { type: "select"; name: string };
