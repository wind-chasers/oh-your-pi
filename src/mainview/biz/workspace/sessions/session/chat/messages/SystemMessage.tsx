import { type ReactElement } from "react";
import { MarkdownContent } from "@view/components/markdown-content";
type SystemMessageProps = { text: string };

export function SystemMessage({ text }: SystemMessageProps): ReactElement {
	return (
		<article className="max-w-[90%]">
			<div className="rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm">
				<p className="mb-2 text-xs text-muted-foreground">系统</p>
				<MarkdownContent>{text || "[无文本内容]"}</MarkdownContent>
			</div>
		</article>
	);
}
