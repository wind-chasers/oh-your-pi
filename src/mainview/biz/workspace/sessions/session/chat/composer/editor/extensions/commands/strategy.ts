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
import type { CommandExtensionState, CommandPanelEvent } from "./model";
import { commandSource } from "./source";

const COMMAND_BREAK_CHARACTERS = new Set([
	"/", ":", "：", ",", "，", ";", "；", "!", "！", "?", "？", "。", ".",
	"\"", "'", "“", "”", "‘", "’", "`", "(", ")", "（", "）",
	"[", "]", "{", "}", "<", ">", "|", "&", "=", "#", "@",
]);

function isCommandBreakCharacter(character: string): boolean {
	return /\s/u.test(character) || COMMAND_BREAK_CHARACTERS.has(character);
}

function acceptCommand(state: CommandExtensionState): EditorExtensionResult<CommandExtensionState> {
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
	return commands[state.activeIndex] ? acceptCommand(state) : { type: "ignore" };
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
	return commands.some(({ name }) => name === event.name)
		? acceptCommand(state)
		: { type: "ignore" };
}

