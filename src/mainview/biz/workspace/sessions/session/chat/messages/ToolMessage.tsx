import { type ReactElement } from "react";
import { MarkdownContent } from "@view/components/markdown-content";
type ToolMessageProps = { label: string; text: string };

export function ToolMessage({ label, text }: ToolMessageProps): ReactElement {
	return (
		<article className="max-w-[90%]" data-testid="tool-message">
			<div className="rounded-xl border border-border/70 bg-muted/35 px-4 py-3 text-sm">
				<p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
				<MarkdownContent>{text || "[无文本内容]"}</MarkdownContent>
			</div>
		</article>
	);
}
