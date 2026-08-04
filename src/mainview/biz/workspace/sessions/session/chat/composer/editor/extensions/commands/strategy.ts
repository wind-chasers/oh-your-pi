import type {
	EditorCommand,
	EditorExtensionEvent,
	EditorExtensionResult,
	EditorExtensionTransition,
	EditorTriggerContext,
} from "../../framework";
import {
	createTokenState,
	moveActiveIndex,
	transitionTokenState,
} from "../shared/token";
import type {
	CommandDefinition,
	CommandEditorEffect,
	CommandExtensionState,
	CommandPanelEvent,
} from "./model";
import { commandSource } from "./source";

const COMMAND_BREAK_CHARACTERS = new Set([
	"/", ":", "：", ",", "，", ";", "；", "!", "！", "?", "？", "。", ".",
	"\"", "'", "“", "”", "‘", "’", "`", "(", ")", "（", "）",
	"[", "]", "{", "}", "<", ">", "|", "&", "=", "#", "@",
]);

function isCommandBreakCharacter(character: string): boolean {
	return /\s/u.test(character) || COMMAND_BREAK_CHARACTERS.has(character);
}

function acceptCommand(
	state: CommandExtensionState,
	command: CommandDefinition,
): EditorExtensionResult<CommandExtensionState> {
	const effect: CommandEditorEffect = { command: command.id, type: "command" };
	return {
		type: "transaction",
		transaction: {
			close: true,
			edit: {
				cursor: state.triggerIndex,
				from: state.triggerIndex,
				insert: "",
				to: state.tokenEnd,
			},
			effect,
		},
	};
}

function completeCommand(
	state: CommandExtensionState,
	command: CommandDefinition,
): EditorExtensionResult<CommandExtensionState> {
	const query = state.query.toLocaleLowerCase();
	const name = command.name.toLocaleLowerCase();
	if (!query || query === name || !name.startsWith(query)) return { type: "ignore" };
	const tokenEnd = state.triggerIndex + 1 + command.name.length;
	return {
		type: "transaction",
		state: { ...state, query: command.name, tokenEnd },
		transaction: {
			close: false,
			edit: {
				cursor: tokenEnd,
				from: state.triggerIndex + 1,
				insert: command.name,
				to: state.tokenEnd,
			},
		},
	};
}

export function activateCommand(context: EditorTriggerContext): CommandExtensionState | null {
	const token = createTokenState(context, "/");
	return token ? { ...token, activeIndex: 0 } : null;
}

export function transitionCommand(
	state: CommandExtensionState,
	event: EditorExtensionEvent,
	draft: string,
): EditorExtensionTransition<CommandExtensionState> {
	const transition = transitionTokenState(state, event, draft, isCommandBreakCharacter);
	if (transition.type === "close") return transition;
	const nextState = transition.state.query === state.query
		? transition.state
		: { ...transition.state, activeIndex: 0 };
	return { type: "update", state: nextState };
}

export function handleCommandCommand(
	state: CommandExtensionState,
	command: EditorCommand,
): EditorExtensionResult<CommandExtensionState> {
	if (command.type === "cancel") return { type: "close" };
	const commands = commandSource.search(state.query);
	if (command.type === "navigate") {
		const activeIndex = moveActiveIndex(state.activeIndex, commands.length, command.direction);
		return activeIndex === null
			? { type: "ignore" }
			: { type: "update", state: { ...state, activeIndex } };
	}
	const selected = commands[state.activeIndex];
	if (!selected) return { type: "ignore" };
	return command.source === "tab"
		? completeCommand(state, selected)
		: acceptCommand(state, selected);
}

export function handleCommandPanelEvent(
	state: CommandExtensionState,
	event: CommandPanelEvent,
): EditorExtensionResult<CommandExtensionState> {
	const commands = commandSource.search(state.query);
	if (event.type === "hover") {
		if (event.index < 0 || event.index >= commands.length) return { type: "ignore" };
		return { type: "update", state: { ...state, activeIndex: event.index } };
	}
	const selected = commands.find((command) => command.id === event.id);
	return selected ? acceptCommand(state, selected) : { type: "ignore" };
}

