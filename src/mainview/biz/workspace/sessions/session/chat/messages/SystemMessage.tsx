import { type ReactElement } from "react";
import { MarkdownContent } from "@view/components/markdown/markdown-content";
type SystemMessageProps = { text: string };

export function SystemMessage({ text }: SystemMessageProps): ReactElement {
	return (
		<article className="max-w-[90%]" data-dbg="system-message">
			<div className="rounded-xl border border-border/70 bg-muted/35 px-4 py-3 text-sm">
				<p className="mb-2 text-xs font-medium text-muted-foreground">系统</p>
				<MarkdownContent>{text || "[无文本内容]"}</MarkdownContent>
			</div>
		</article>
	);
}
