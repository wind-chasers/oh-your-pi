import { BrainCircuit, ChevronDown } from "lucide-react";
import { type ReactElement } from "react";
import { MarkdownContent } from "@view/components/markdown-content";

type AssistantMessageProps = {
	text: string;
	thinking?: string;
};

export function AssistantMessage({ text, thinking }: AssistantMessageProps): ReactElement {
	return (
		<article className="max-w-[90%]">
			{thinking ? <ThinkingMessage text={thinking} /> : null}
			<div className="rounded-2xl rounded-bl-xs border bg-card px-4 py-3 text-sm">
				<MarkdownContent>{text || "[无文本内容]"}</MarkdownContent>
			</div>
		</article>
	);
}

function ThinkingMessage({ text }: { text: string }): ReactElement {
	const preview = text.replace(/\s+/g, " ").trim();
	return (
		<details className="group mb-2 overflow-hidden rounded-xl border border-dashed border-primary/20 bg-muted/35 transition-colors open:bg-muted/55 motion-reduce:transition-none">
			<summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
				<BrainCircuit aria-hidden className="size-3.5 shrink-0 text-primary/70" />
				<span className="min-w-0 flex-1 truncate font-normal text-muted-foreground/80">{preview}</span>
				<ChevronDown aria-hidden className="size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
			</summary>
			<div className="border-t border-dashed border-primary/10 px-3 py-3 text-sm text-muted-foreground">
				<MarkdownContent>{text}</MarkdownContent>
			</div>
		</details>
	);
}
