import type {
	EditorExtensionEvent,
	EditorExtensionTransition,
	EditorTriggerContext,
} from "../../framework";

export interface TokenExtensionState {
	query: string;
	tokenEnd: number;
	trigger: string;
	triggerIndex: number;
}

export function createTokenState(
	context: EditorTriggerContext,
	expectedTrigger: string,
): TokenExtensionState | null {
	if (context.input.draft[context.triggerIndex] !== expectedTrigger) return null;
	return {
		query: "",
		tokenEnd: context.triggerIndex + 1,
		trigger: expectedTrigger,
		triggerIndex: context.triggerIndex,
	};
}

export function transitionTokenState<TState extends TokenExtensionState>(
	state: TState,
	event: EditorExtensionEvent,
	draft: string,
	isBreakCharacter: (character: string) => boolean,
): EditorExtensionTransition<TState> {
	const selectionStart = event.type === "input"
		? event.input.selectionStart
		: event.selectionStart;
	const selectionEnd = event.type === "input"
		? event.input.selectionEnd
		: event.selectionEnd;
	if (
		selectionStart !== selectionEnd
		|| selectionStart <= state.triggerIndex
		|| draft[state.triggerIndex] !== state.trigger
	) return { type: "close" };

	let tokenEnd = draft.length;
	for (let index = state.triggerIndex + 1; index < draft.length; index += 1) {
		if (isBreakCharacter(draft[index])) {
			tokenEnd = index;
			break;
		}
	}
	if (selectionStart > tokenEnd) return { type: "close" };

	const query = draft.slice(state.triggerIndex + 1, tokenEnd);
	if (query === state.query && tokenEnd === state.tokenEnd) {
		return { type: "update", state };
	}
	return {
		type: "update",
		state: { ...state, query, tokenEnd },
	};
}

export function moveActiveIndex(
	activeIndex: number,
	itemCount: number,
	direction: "next" | "previous",
): number | null {
	if (itemCount === 0) return null;
	const offset = direction === "next" ? 1 : -1;
	return (activeIndex + offset + itemCount) % itemCount;
}
