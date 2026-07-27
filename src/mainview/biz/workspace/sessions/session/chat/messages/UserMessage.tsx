import { type ReactElement } from "react";
import { MarkdownContent } from "@view/components/markdown-content";
type UserMessageProps = { text: string };

export function UserMessage({ text }: UserMessageProps): ReactElement {
	return (
		<article className="ml-auto w-fit max-w-[85%]" data-dbg="user-message">
			<div className="rounded-2xl rounded-br-xs bg-primary px-4 py-2 text-sm text-primary-foreground">
				<MarkdownContent>{text || "[无文本内容]"}</MarkdownContent>
			</div>
		</article>
	);
}
