import {
	useCallback,
	useRef,
	type ChangeEvent,
	type ComponentPropsWithoutRef,
	type KeyboardEvent,
	type RefObject,
	type SyntheticEvent,
} from "react";
import { ChatEditorAtom } from "@view/biz/workspace/sessions/session/session.atom";
import { useEditorEffectHandler } from "./effects";
import { EditorFloat } from "./Float";
import type { EditorTextEdit } from "./framework";

type EditorProps = Pick<ComponentPropsWithoutRef<"textarea">, "disabled" | "onPaste" | "placeholder">;

interface EditorTextareaProps extends ComponentPropsWithoutRef<"textarea"> {
	area: RefObject<HTMLTextAreaElement | null>;
}

function apply(textarea: HTMLTextAreaElement, edit: EditorTextEdit) {
	textarea.focus();
	textarea.setSelectionRange(edit.from, edit.to);
	// Keep extension edits in Chromium's native textarea undo stack.
	document.execCommand("insertText", false, edit.insert);
	requestAnimationFrame(() => {
		textarea.focus();
		textarea.setSelectionRange(edit.cursor, edit.cursor);
	});
}

export function Editor(props: EditorProps) {
	const area = useRef<HTMLTextAreaElement>(null);
	const editor = ChatEditorAtom.useDerived();
	const onEffect = useEditorEffectHandler();
	const applyEdit = useCallback((edit: EditorTextEdit) => {
		const textarea = area.current;
		textarea && apply(textarea, edit);
	}, []);
	editor.useRegisterHandlers(applyEdit, onEffect);
	return (
		<>
			<EditorTextarea {...props} area={area} />
			<EditorFloat anchorRef={area} disabled={props.disabled} />
		</>
	);
}

function EditorTextarea({ area, ...props }: EditorTextareaProps) {
	const editor = ChatEditorAtom.useDerived();
	const draft = editor.useDraft();
	const composing = useRef(false);

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		if (composing.current || event.nativeEvent.isComposing) return;

		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
			return;
		}

		if (event.key === "Escape" && editor.command({ type: "cancel" })) {
			event.preventDefault();
			return;
		}

		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			const direction = event.key === "ArrowDown" ? "next" : "previous";
			if (editor.command({ type: "navigate", direction })) {
				event.preventDefault();
				return;
			}
		}

		const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
		if (!hasModifier && (event.key === "Enter" || event.key === "Tab")) {
			const source = event.key === "Enter" ? "enter" : "tab";
			if (editor.command({ type: "accept", source })) {
				event.preventDefault();
				return;
			}
		}
	}

	function handleCompositionStart(): void {
		composing.current = true;
	}

	function handleCompositionEnd(): void {
		composing.current = false;
	}

	function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
		const textarea = event.currentTarget;
		const inputEvent = event.nativeEvent as InputEvent;
		editor.input({
			draft: textarea.value,
			inputType: inputEvent.inputType ?? "",
			insertedText: inputEvent.data ?? null,
			isComposing: composing.current || inputEvent.isComposing,
			selectionEnd: textarea.selectionEnd,
			selectionStart: textarea.selectionStart,
		});
	}

	function handleSelect(event: SyntheticEvent<HTMLTextAreaElement>): void {
		if (composing.current) return;
		editor.selectionChange(
			event.currentTarget.selectionStart,
			event.currentTarget.selectionEnd,
		);
	}

	return (
		<textarea
			{...props}
			ref={area}
			aria-label="发送给 Pi 的消息"
			className="block min-h-lh max-h-[8lh] w-full field-sizing-content resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground/40"
			onChange={handleChange}
			onCompositionEnd={handleCompositionEnd}
			onCompositionStart={handleCompositionStart}
			onKeyDown={handleKeyDown}
			onSelect={handleSelect}
			rows={1}
			value={draft}
		/>
	);
}

