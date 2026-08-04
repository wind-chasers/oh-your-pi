import { useLayoutEffect } from "react";
import type { Unit } from "@view/atom/local";
import { chatExtensionRegistry, editExtensionRegistry, type EditorExtensionRegistry } from "./extensions";
import {
	applyEditorTextEdit,
	getInsertedTrigger,
	type ActiveEditorExtension,
	type EditorCommand,
	type EditorExtensionResult,
	type EditorInput,
	type EditorTextEdit,
	type EditorEffect,
} from "./framework";

export interface ChatEditorState {
	active: ActiveEditorExtension | null;
	draft: string;
}
type EditorHandlers = {
	effect: (effect: EditorEffect) => void;
	edit: (edit: EditorTextEdit) => void;
};

export const zeroEditorState: ChatEditorState = { active: null, draft: "" };
const NOOP = () => {};
const NOOP_HANDLERS: EditorHandlers = { effect: NOOP, edit: NOOP };

function createEditorRuntime(
	{ get, set, select }: Unit<ChatEditorState>,
	registry: EditorExtensionRegistry,
) {
	function activate(input: EditorInput, previousDraft: string): ActiveEditorExtension | null {
		const trigger = getInsertedTrigger(input, previousDraft);
		if (!trigger) return null;
		const extension = registry.byTrigger.get(trigger.character);
		if (!extension) return null;
		const state = extension.activate({
			draft: input.draft,
			input,
			triggerIndex: trigger.index,
		});
		return state === null ? null : { extension, state };
	}

	function input(event: EditorInput): void {
		const current = get();
		if (event.draft === current.draft) return;
		if (event.isComposing) {
			return set({ ...current, draft: event.draft });
		}
		let active = current.active;
		if (active) {
			const transition = active.extension.transition(
				active.state,
				{ type: "input", input: event },
				{ draft: event.draft },
			);
			active = transition.type === "close"
				? activate(event, current.draft)
				: { ...active, state: transition.state };
		} else {
			active = activate(event, current.draft);
		}
		set({ active, draft: event.draft });
	}

	function selectionChange(selectionStart: number, selectionEnd: number): void {
		const current = get();
		if (!current.active) return;
		const transition = current.active.extension.transition(
			current.active.state,
			{ type: "selection", selectionEnd, selectionStart },
			{ draft: current.draft },
		);
		const active = transition.type === "close"
			? null
			: { ...current.active, state: transition.state };
		if (active?.state === current.active.state) return;
		set({ ...current, active });
	}

	let handlers: EditorHandlers = NOOP_HANDLERS;
	function useRegisterHandlers(edit: EditorHandlers["edit"], effect: EditorHandlers["effect"]) {
		useLayoutEffect(() => {
			const registered: EditorHandlers = { edit, effect };
			handlers = registered;
			return () => {
				if (handlers === registered) handlers = NOOP_HANDLERS;
			};
		}, [edit, effect]);
	}

	function applyResult(result: EditorExtensionResult<any>): boolean {
		const current = get();
		if (!current.active || result.type === "ignore") return false;
		if (result.type === "close") {
			set({ ...current, active: null });
			return true;
		}
		if (result.type === "update") {
			set({ ...current, active: { ...current.active, state: result.state } });
			return true;
		}

		const { transaction } = result;
		const draft = transaction.edit
			? applyEditorTextEdit(current.draft, transaction.edit)
			: current.draft;
		const active = transaction.close
			? null
			: {
				...current.active,
				state: result.state ?? current.active.state,
			};
		set({ active, draft });
		if (transaction.edit) handlers.edit(transaction.edit);
		if (transaction.effect) handlers.effect(transaction.effect);
		return true;
	}

	function command(command: EditorCommand): boolean {
		const current = get();
		if (!current.active) return false;
		return applyResult(current.active.extension.handleCommand(
			current.active.state,
			command,
			{ draft: current.draft },
		));
	}

	function dispatchExtensionEvent(event: any): boolean {
		const current = get();
		if (!current.active) return false;
		return applyResult(current.active.extension.handlePanelEvent(
			current.active.state,
			event,
			{ draft: current.draft },
		));
	}

	function closeFloat(): boolean {
		const current = get();
		if (!current.active) return false;
		set({ ...current, active: null });
		return true;
	}

	function reset(draft?: string): void {
		set(draft === undefined ? zeroEditorState : { active: null, draft });
	}

	const useValid = select(({ draft }) => draft.trim() !== "");
	const useDraft = select(({ draft }) => draft);
	const useFloatState = select(({ active }) => active);

	return {
		closeFloat,
		command,
		dispatchExtensionEvent,
		get,
		input,
		reset,
		selectionChange,
		useDraft,
		useFloatState,
		useValid,
		useRegisterHandlers,
	};
}

export const deriveChatEditorState = (unit: Unit<ChatEditorState>) => createEditorRuntime(unit, chatExtensionRegistry);
export const deriveEditEditorState = (unit: Unit<ChatEditorState>) => createEditorRuntime(unit, editExtensionRegistry);


export type EditorRuntime = ReturnType<typeof createEditorRuntime>;
