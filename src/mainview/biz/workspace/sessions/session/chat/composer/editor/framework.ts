import type { ComponentType } from "react";

export interface EditorInput {
	draft: string;
	inputType: string;
	insertedText: string | null;
	isComposing: boolean;
	selectionEnd: number;
	selectionStart: number;
}

export type EditorExtensionEvent =
	| { type: "input"; input: EditorInput }
	| { type: "selection"; selectionEnd: number; selectionStart: number };

export type EditorCommand =
	| { type: "navigate"; direction: "next" | "previous" }
	| { type: "accept"; source: "enter" | "tab" }
	| { type: "cancel" };

export interface EditorTextEdit {
	cursor: number;
	from: number;
	insert: string;
	to: number;
}

export interface EditorTransaction {
	close: boolean;
	edit?: EditorTextEdit;
	effect?: () => void;
}

export interface EditorExtensionContext {
	draft: string;
}

export interface EditorTriggerContext extends EditorExtensionContext {
	input: EditorInput;
	triggerIndex: number;
}

export type EditorExtensionTransition<TState> =
	| { type: "close" }
	| { type: "update"; state: TState };

export type EditorExtensionResult<TState> =
	| { type: "close" }
	| { type: "ignore" }
	| { type: "transaction"; state?: TState; transaction: EditorTransaction }
	| { type: "update"; state: TState };

export interface EditorExtensionPanelProps<TState, TPanelEvent> {
	dispatch: (event: TPanelEvent) => void;
	state: TState;
}

export interface EditorExtensionSurface {
	align?: "center" | "end" | "start";
	className?: string;
	side?: "bottom" | "left" | "right" | "top";
	sideOffset?: number;
}

export interface EditorExtension<TState, TPanelEvent> {
	Panel: ComponentType<EditorExtensionPanelProps<TState, TPanelEvent>>;
	activate: (context: EditorTriggerContext) => TState | null;
	handleCommand: (
		state: TState,
		command: EditorCommand,
		context: EditorExtensionContext,
	) => EditorExtensionResult<TState>;
	handlePanelEvent: (
		state: TState,
		event: TPanelEvent,
		context: EditorExtensionContext,
	) => EditorExtensionResult<TState>;
	id: string;
	surface?: EditorExtensionSurface;
	transition: (
		state: TState,
		event: EditorExtensionEvent,
		context: EditorExtensionContext,
	) => EditorExtensionTransition<TState>;
	triggers: readonly string[];
}

export type RegisteredEditorExtensionPanelProps = EditorExtensionPanelProps<any, any>;
export type RegisteredEditorExtension = EditorExtension<any, any>;

export interface ActiveEditorExtension {
	extension: RegisteredEditorExtension;
	state: any;
}

export function defineEditorExtension<TState, TPanelEvent>(
	extension: EditorExtension<TState, TPanelEvent>,
) {
	return extension;
}

export function getInsertedTrigger(
	input: EditorInput,
	previousDraft: string,
): { character: string; index: number } | null {
	if (
		input.isComposing
		|| input.selectionStart !== input.selectionEnd
		|| (input.inputType !== "" && !input.inputType.startsWith("insert"))
	) return null;

	const index = input.selectionStart - 1;
	if (index < 0) return null;
	let character = input.insertedText?.length === 1 ? input.insertedText : null;
	if (!character) {
		if (input.draft.length !== previousDraft.length + 1) return null;
		const draftWithoutInsertedCharacter = `${input.draft.slice(0, index)}${input.draft.slice(index + 1)}`;
		if (draftWithoutInsertedCharacter !== previousDraft) return null;
		character = input.draft[index];
	}
	if (input.draft[index] !== character) return null;
	return { character, index };
}

export function applyEditorTextEdit(draft: string, edit: EditorTextEdit): string {
	if (
		edit.from < 0
		|| edit.to < edit.from
		|| edit.to > draft.length
	) throw new RangeError("Editor extension returned an invalid text edit range");
	const nextDraft = `${draft.slice(0, edit.from)}${edit.insert}${draft.slice(edit.to)}`;
	if (edit.cursor < 0 || edit.cursor > nextDraft.length) {
		throw new RangeError("Editor extension returned an invalid cursor position");
	}
	return nextDraft;
}
