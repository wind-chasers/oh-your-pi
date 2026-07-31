import { useRef } from "react";
import { ChatEditorAtom } from "@view/biz/workspace/sessions/session/session.atom";

interface Props {
  disabled?: boolean;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}

export function Editor(props: Props) {
  const editor = ChatEditorAtom.useDerived();
  const draft = editor.useDraft();
  const area = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
		if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
		event.preventDefault();
		event.currentTarget.form?.requestSubmit();
	}

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    editor.change(event.target.value);
  }

  return (
    <textarea
      ref={area}
      aria-label="发送给 Pi 的消息"
      className="block min-h-lh max-h-[8lh] w-full field-sizing-content resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground/40"
      disabled={props.disabled}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={props.onPaste}
      placeholder={props.placeholder}
      rows={1}
      value={draft}
    />
  );
}

