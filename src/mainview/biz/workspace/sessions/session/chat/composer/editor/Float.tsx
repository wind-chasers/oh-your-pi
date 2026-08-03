import { useCallback, useEffect, type RefObject } from "react";
import { ChatEditorAtom } from "@view/biz/workspace/sessions/session/session.atom";
import { Popover, PopoverAnchor, PopoverContent } from "@view/components/ui/popover";
import type { EditorTextEdit } from "./framework";

interface EditorFloatProps {
	anchorRef: RefObject<HTMLTextAreaElement | null>;
	disabled?: boolean;
	onEdit: (edit: EditorTextEdit) => void;
}

export function EditorFloat({ anchorRef, disabled, onEdit }: EditorFloatProps) {
	const editor = ChatEditorAtom.useDerived();
	const active = editor.useFloatState();
	const dispatch = useCallback((event: any) => editor.dispatchExtensionEvent(event, onEdit), [editor, onEdit]);

	useEffect(() => {
		if (disabled) editor.closeFloat();
	}, [disabled]);

	function content() {
		if (!active || disabled) return null;
		const { state, extension: { id, surface, Panel } } = active;
		return (
			<PopoverContent
				align={surface?.align ?? "start"}
				className={surface?.className}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onOpenAutoFocus={(event) => event.preventDefault()}
				side={surface?.side ?? "top"}
				sideOffset={surface?.sideOffset ?? 8}
			>
				<Panel dispatch={dispatch} key={id} state={state} />
			</PopoverContent>
		);
	}

	return (
		<Popover
			modal={false}
			onOpenChange={(v) => { !v && editor.closeFloat() }}
			open={Boolean(!disabled && active)}
		>
			<PopoverAnchor virtualRef={anchorRef} />
			{content()}
		</Popover>
	);
}
