import { BrainCircuit, ChevronDown } from "lucide-react";
import { type ReactElement } from "react";
import { MarkdownContent } from "@view/components/markdown-content";

type AssistantMessageProps = {
	text: string;
	thinking?: string;
};

export function AssistantMessage({ text, thinking }: AssistantMessageProps): ReactElement {
	return (
		<article className="max-w-[90%] flex flex-col gap-1.5" data-dbg="assistant-message">
			{thinking && <ThinkingMessage text={thinking} />}
			{text && (
				<div className="rounded-2xl rounded-bl-xs border bg-card px-4 py-3 text-sm">
					<MarkdownContent>{text}</MarkdownContent>
				</div>
			)}
		</article>
	);
}

function ThinkingMessage({ text }: { text: string }): ReactElement {
	const preview = text.replace(/\s+/g, " ").trim();
	return (
		<details className="group overflow-hidden rounded border border-dashed bg-muted/35 transition-colors open:bg-muted/55">
			<summary className="flex cursor-pointer list-none items-center gap-2 p-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
				<BrainCircuit aria-hidden className="size-3.5 shrink-0 text-primary/70" />
				<span className="min-w-0 flex-1 truncate font-normal text-muted-foreground/80">{preview}</span>
				<ChevronDown aria-hidden className="size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180" />
			</summary>
			<div className="border-t border-dashed border-primary/10 px-3 py-3 text-sm text-muted-foreground">
				<MarkdownContent>{text}</MarkdownContent>
			</div>
		</details>
	);
}
