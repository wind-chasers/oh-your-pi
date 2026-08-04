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
	const insert = file.isDirectory ? `${file.path}/` : file.path;
	const isDirectory = file.isDirectory;
	const nextTokenEnd = state.triggerIndex + 1 + insert.length;
	return {
		type: "transaction",
		transaction: {
			close: !isDirectory,
			edit: {
				cursor: nextTokenEnd,
				from: state.triggerIndex + 1,
				insert,
				to: state.tokenEnd,
			},
		},
		state: isDirectory
			? {
				...state,
				activeIndex: 0,
				files: [],
				query: insert,
				status: "loading",
				tokenEnd: nextTokenEnd,
			}
			: undefined,
	};
}

export function activateFileMention(context: EditorTriggerContext): FileMentionState | null {
	const token = createTokenState(context, "@");
	return token ? { ...token, activeIndex: 0, files: [], status: "loading" } : null;
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
		: { ...transition.state, activeIndex: 0, files: [], status: "loading" as const };
	return { type: "update", state: nextState };
}

export function handleFileMentionCommand(
	state: FileMentionState,
	command: EditorCommand,
): EditorExtensionResult<FileMentionState> {
	if (command.type === "cancel") return { type: "close" };
	if (command.type === "navigate") {
		const activeIndex = moveActiveIndex(state.activeIndex, state.files.length, command.direction);
		return activeIndex === null
			? { type: "ignore" }
			: { type: "update", state: { ...state, activeIndex } };
	}
	const file = state.files[state.activeIndex];
	return file ? acceptFile(state, file) : { type: "ignore" };
}

export function handleFileMentionPanelEvent(
	state: FileMentionState,
	event: FileMentionPanelEvent,
): EditorExtensionResult<FileMentionState> {
	if (event.type === "search") {
		if (event.query !== state.query) return { type: "ignore" };
		return { type: "update", state: { ...state, files: event.files, status: event.status } };
	}
	if (event.type === "hover") {
		if (event.index < 0 || event.index >= state.files.length) return { type: "ignore" };
		return { type: "update", state: { ...state, activeIndex: event.index } };
	}
	const file = state.files.find(({ path }) => path === event.path);
	return file ? acceptFile(state, file) : { type: "ignore" };
}

