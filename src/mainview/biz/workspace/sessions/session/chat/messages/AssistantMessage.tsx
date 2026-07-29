import { BrainCircuit, ChevronDown, Sparkles } from "lucide-react";
import { type ReactElement } from "react";
import { MarkdownContent } from "@view/components/markdown/markdown-content";
import { cn } from "@view/lib/utils";

type AssistantMessageProps = {
	text: string;
	thinking?: string;
	isStreaming?: boolean;
};

export function AssistantMessage({ text, thinking, isStreaming = false }: AssistantMessageProps): ReactElement | null {
	if (!text && !thinking && !isStreaming) return null;

	return (
		<article className="flex max-w-[90%] flex-col gap-2" data-dbg="assistant-message">
			{thinking ? <ThinkingMessage isStreaming={isStreaming} text={thinking} /> : null}
			{text ? (
				<div className={cn(
					"rounded border bg-card px-4 py-3.5 text-sm shadow-[0_1px_2px_0_rgb(15_23_42/0.03),0_2px_5px_0_rgb(15_23_42/0.02)] dark:shadow-[0_1px_2px_0_rgb(0_0_0/0.18),0_2px_5px_0_rgb(0_0_0/0.12)]",
					isStreaming ? "border-primary/25" : "border-border/70"
				)}>
					{isStreaming ? (
						<p className="mb-2 text-xs font-medium text-muted-foreground">回复中</p>
					) : (
						// Todo 给头部留点空间放置一些操作按钮
						<div className="h-0 mb-2"/>
					)}
					<MarkdownContent stable={!isStreaming}>{text}</MarkdownContent>
				</div>
			) : null}
			{isStreaming && !text && !thinking ? <StreamingPlaceholder /> : null}
		</article>
	);
}

function ThinkingMessage({ isStreaming, text }: { isStreaming: boolean; text: string }): ReactElement {
	const preview = text.replace(/\s+/g, " ").trim();
	return (
		<details className="group overflow-hidden rounded border border-dashed border-border/80 bg-muted/30 transition-colors open:bg-muted/50" open={isStreaming || undefined}>
			<summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 p-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
				<BrainCircuit aria-hidden className="size-3.5 shrink-0 text-primary/70" />
				<span className="min-w-0 flex-1 truncate font-normal text-muted-foreground/85">{isStreaming ? "思考中" : preview}</span>
				<ChevronDown aria-hidden className="size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180" />
			</summary>
			<div className="border-t border-dashed border-border/70 p-3 text-sm text-muted-foreground">
				<MarkdownContent stable={!isStreaming}>{text}</MarkdownContent>
			</div>
		</details>
	);
}

function StreamingPlaceholder(): ReactElement {
	return (
		<div className="flex items-center gap-2 rounded border border-border/70 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
			<Sparkles aria-hidden className="size-4 animate-pulse motion-reduce:animate-none" />
			正在思考…
		</div>
	);
}
