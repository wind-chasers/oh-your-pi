import { useEffect, type RefObject } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@view/components/ui/popover";
import type { EditorRuntime } from "./state";

interface EditorFloatProps {
	anchorRef: RefObject<HTMLTextAreaElement | null>;
	disabled?: boolean;
	editor: EditorRuntime;
}

export function EditorFloat({ anchorRef, disabled, editor }: EditorFloatProps) {
	const active = editor.useFloatState();

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
				<Panel dispatch={editor.dispatchExtensionEvent} key={id} state={state} />
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
