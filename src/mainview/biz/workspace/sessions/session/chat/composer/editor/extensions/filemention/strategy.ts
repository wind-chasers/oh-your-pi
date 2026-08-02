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
import type { FileMentionPanelEvent, FileMentionState, WorkspaceFile } from "./model";
import { fileMentionSource } from "./source";

const FILE_BREAK_CHARACTERS = new Set([
	":", "：", ",", "，", ";", "；", "!", "！", "?", "？", "。",
	"\"", "'", "“", "”", "‘", "’", "`", "(", ")", "（", "）",
	"[", "]", "{", "}", "<", ">", "|", "&", "=", "#", "@",
]);

function isFileBreakCharacter(character: string): boolean {
	return /\s/u.test(character) || FILE_BREAK_CHARACTERS.has(character);
}

function acceptFile(
	state: FileMentionState,
	file: WorkspaceFile,
): EditorExtensionResult<FileMentionState> {
	return {
		type: "transaction",
		transaction: {
			close: true,
			edit: {
				cursor: state.triggerIndex + 1 + file.path.length,
				from: state.triggerIndex + 1,
				insert: file.path,
				to: state.tokenEnd,
			},
		},
	};
}

export function activateFileMention(context: EditorTriggerContext): FileMentionState | null {
	const token = createTokenState(context, "@");
	return token ? { ...token, activeIndex: 0 } : null;
}

export function transitionFileMention(
	state: FileMentionState,
	event: EditorExtensionEvent,
	draft: string,
): EditorExtensionTransition<FileMentionState> {
	const transition = transitionTokenState(state, event, draft, isFileBreakCharacter);
	if (transition.type === "close") return transition;
	const nextState = transition.state.query === state.query
		? transition.state
		: { ...transition.state, activeIndex: 0 };
	return { type: "update", state: nextState };
}

export function handleFileMentionCommand(
	state: FileMentionState,
	command: EditorCommand,
): EditorExtensionResult<FileMentionState> {
	if (command.type === "cancel") return { type: "close" };
	const files = fileMentionSource.search(state.query);
	if (command.type === "navigate") {
		const activeIndex = moveActiveIndex(state.activeIndex, files.length, command.direction);
		return activeIndex === null
			? { type: "ignore" }
			: { type: "update", state: { ...state, activeIndex } };
	}
	const file = files[state.activeIndex];
	return file ? acceptFile(state, file) : { type: "ignore" };
}

export function handleFileMentionPanelEvent(
	state: FileMentionState,
	event: FileMentionPanelEvent,
): EditorExtensionResult<FileMentionState> {
	const files = fileMentionSource.search(state.query);
	if (event.type === "hover") {
		if (event.index < 0 || event.index >= files.length) return { type: "ignore" };
		return { type: "update", state: { ...state, activeIndex: event.index } };
	}
	const file = files.find(({ path }) => path === event.path);
	return file ? acceptFile(state, file) : { type: "ignore" };
}

