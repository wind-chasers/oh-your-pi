import { BrainCircuit, Check, ChevronDown, CircleX, Clock, Copy, LogIn, LogOut, Sparkles } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { MarkdownContent } from "@view/components/markdown/markdown-content";
import { Button } from "@view/components/ui/button";
import { cn } from "@view/lib/utils";


const COPY_STATUS_DURATION_MS = 2_000;

type CopyStatus = "idle" | "copied" | "failed";

type TokenUsage = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
};
type AssistantMessageProps = {
	text: string;
	thinking?: string;
	isStreaming?: boolean;
	timestamp?: number;
	usage?: TokenUsage;
};

export function AssistantMessage({ text, thinking, isStreaming = false, timestamp, usage }: AssistantMessageProps): ReactElement | null {
	if (!text && !thinking && !isStreaming) return null;

	return (
		<article className="flex max-w-[90%] flex-col gap-2" data-dbg="assistant-message">
			{thinking ? <ThinkingMessage isStreaming={isStreaming} text={thinking} /> : null}
			{text ? (
				<div className={cn(
					"rounded border bg-card text-sm shadow-[0_1px_2px_0_rgb(15_23_42/0.03),0_2px_5px_0_rgb(15_23_42/0.02)] dark:shadow-[0_1px_2px_0_rgb(0_0_0/0.18),0_2px_5px_0_rgb(0_0_0/0.12)]",
					isStreaming ? "border-primary/25" : "border-border/70"
				)}>
					<div className="px-4 py-3.5">
						{isStreaming && (
							<p className="mb-2 font-medium text-muted-foreground">回复中</p>
						)}
						<MarkdownContent stable={!isStreaming}>{text}</MarkdownContent>
					</div>
					{!isStreaming && <AssistantFoot text={text} timestamp={timestamp} usage={usage} />}
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

function AssistantFoot({ text, timestamp, usage }: {
	text: string;
	timestamp?: number;
	usage?: TokenUsage;
}): ReactElement {
	const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
	const copyLabel = getCopyLabel(copyStatus);
	const time = formatTimestamp(timestamp);

	useEffect(() => {
		if (copyStatus === "idle") return;
		const timeout = window.setTimeout(() => setCopyStatus("idle"), COPY_STATUS_DURATION_MS);
		return () => window.clearTimeout(timeout);
	}, [copyStatus]);

	async function copyReply(): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			setCopyStatus("copied");
		} catch {
			setCopyStatus("failed");
		}
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/70 px-4 py-0.5 text-xs text-muted-foreground">
			<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
				{time && (
					<time className="inline-flex items-center gap-1 text-muted-foreground/70" dateTime={new Date(timestamp!).toISOString()} title={`消息时间：${time}`}>
						<Clock aria-hidden size={10} />{time}
					</time>
				)}
				{usage ? <UsageSummary usage={usage} /> : null}
			</div>
			<Button
				aria-label={copyLabel}
				className="-mr-1"
				onClick={() => void copyReply()}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<CopyStatusIcon status={copyStatus} />
			</Button>
			<span aria-live="polite" className="sr-only">
				{copyStatus === "idle" ? "" : copyLabel}
			</span>
		</div>
	);
}

function UsageSummary({ usage }: { usage: TokenUsage }): ReactElement {
	const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	const detail = `本轮用量：提示输入 ${formatExactTokens(promptTokens)} tokens，输出 ${formatExactTokens(usage.output)} tokens`;
	return (
		<span aria-label={detail} className="inline-flex items-center gap-1 text-muted-foreground/70 tabular-nums" title={detail}>
			<span aria-hidden className="inline-flex items-center gap-1"><LogIn size={10} />{formatCompactTokens(promptTokens)}</span>
			<span aria-hidden className="inline-flex items-center gap-1"><LogOut size={10} />{formatCompactTokens(usage.output)}</span>
		</span>
	);
}

function CopyStatusIcon({ status }: { status: CopyStatus }): ReactElement {
	if (status === "copied") return <Check aria-hidden />;
	if (status === "failed") return <CircleX aria-hidden />;
	return <Copy aria-hidden />;
}

function getCopyLabel(status: CopyStatus): string {
	if (status === "copied") return "已复制回复";
	if (status === "failed") return "复制失败，请重试";
	return "复制回复";
}

function formatTimestamp(timestamp: number | undefined): string | null {
	if (timestamp === undefined || !Number.isFinite(timestamp)) return null;
	return new Intl.DateTimeFormat("zh-CN", {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "numeric",
		year: "numeric",
	}).format(timestamp);
}

function formatCompactTokens(tokens: number): string {
	if (tokens >= 1_000) {
		const value = tokens / 1_000;
		return value % 1 === 0 ? `${value.toFixed(0)}K` : `${value.toFixed(1)}K`;
	}
	return tokens.toString();
}

function formatExactTokens(tokens: number): string {
	return tokens.toLocaleString("zh-CN");
}
