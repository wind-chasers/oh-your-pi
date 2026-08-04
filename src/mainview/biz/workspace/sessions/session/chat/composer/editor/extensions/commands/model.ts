import type { EditorEffect } from "../../framework";
import type { TokenExtensionState } from "../shared/token";

export type CommandId = "new" | "fork" | "drop" | "compact" | "settings" | "login" | "logout";

export interface CommandDefinition {
	description: string;
	id: CommandId;
	name: string;
}

export type CommandEditorEffect = EditorEffect & {
	command: CommandId;
	type: "command";
};

export interface CommandExtensionState extends TokenExtensionState {
	activeIndex: number;
}

export type CommandPanelEvent =
	| { type: "hover"; index: number }
	| { id: CommandId; type: "select" };

export function isCommandEditorEffect(effect: EditorEffect): effect is CommandEditorEffect {
	return effect.type === "command" && "command" in effect;
}
