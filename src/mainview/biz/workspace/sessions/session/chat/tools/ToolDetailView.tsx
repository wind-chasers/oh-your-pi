import { ArrowDownRight, ArrowUpRight, LoaderCircle, ShieldQuestion } from "lucide-react";
import { type ReactElement, type ReactNode } from "react";
import { cn } from "@view/lib/utils";
import { resolveToolRenderer } from "./registry";
import type {
	ToolCallExecutionStatus,
	ToolCallItem,
	ToolRenderer,
} from "./types";

type ToolDetailViewProps = {
	executionStatus: ToolCallExecutionStatus;
	toolCall: ToolCallItem;
	unbounded?: boolean;
};

export function ToolDetailView({ executionStatus, toolCall, unbounded = false }: ToolDetailViewProps): ReactElement {
	const renderer = resolveToolRenderer(toolCall.name);
	return (
		<div className="flex min-w-0 flex-col gap-2.5">
			<DetailSection icon={<ArrowDownRight aria-hidden />} label="输入">
				<ToolInput executionStatus={executionStatus} renderer={renderer} toolCall={toolCall} unbounded={unbounded} />
			</DetailSection>
			<DetailSection icon={<ArrowUpRight aria-hidden />} label="输出">
				<ToolOutput executionStatus={executionStatus} renderer={renderer} toolCall={toolCall} unbounded={unbounded} />
			</DetailSection>
		</div>
	);
}

function DetailSection({ children, icon, label }: { children: ReactNode; icon: ReactNode; label: string }): ReactElement {
	return (
		<section className="flex min-w-0 flex-col gap-1">
			<header className="flex items-center gap-1 text-xs font-medium text-muted-foreground [&_svg]:size-3">
				{icon}
				<span>{label}</span>
			</header>
			{children}
		</section>
	);
}

function ToolInput({ executionStatus, renderer, toolCall, unbounded }: {
	executionStatus: ToolCallExecutionStatus;
	renderer: ToolRenderer | undefined;
	toolCall: ToolCallItem;
	unbounded: boolean;
}): ReactElement {
	if (renderer?.Input) {
		const Input = renderer.Input;
		return <Input executionStatus={executionStatus} toolCall={toolCall} />;
	}
	const text = renderer?.getInputText?.(toolCall) || stringifyInput(toolCall.input) || "无参数";
	return <CodeBlock text={text} unbounded={unbounded} />;
}

function ToolOutput({ executionStatus, renderer, toolCall, unbounded }: {
	executionStatus: ToolCallExecutionStatus;
	renderer: ToolRenderer | undefined;
	toolCall: ToolCallItem;
	unbounded: boolean;
}): ReactElement {
	if (executionStatus === "awaiting_permission") {
		return <EmptyOutput icon={<ShieldQuestion aria-hidden />} text="等待授权…" />;
	}
	if (executionStatus === "running" && !toolCall.output) {
		return <EmptyOutput icon={<LoaderCircle aria-hidden className="motion-safe:animate-spin" />} text="正在执行…" />;
	}
	if (executionStatus === "interrupted" && !toolCall.output) {
		return <EmptyOutput text="执行已中断，未返回结果。" />;
	}
	if (!toolCall.output) return <EmptyOutput text="无输出" />;
	if (toolCall.isError) return <CodeBlock destructive text={toolCall.output} unbounded={unbounded} />;
	if (renderer?.Output) {
		const Output = renderer.Output;
		return <Output executionStatus={executionStatus} toolCall={toolCall} />;
	}
	const text = renderer?.getOutputText?.(toolCall) || toolCall.output;
	return <CodeBlock text={text} unbounded={unbounded} />;
}

function EmptyOutput({ icon, text }: { icon?: ReactNode; text: string }): ReactElement {
	return (
		<div className="flex min-h-9 items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground [&_svg]:size-3.5">
			{icon}
			<span>{text}</span>
		</div>
	);
}

function CodeBlock({ destructive = false, text, unbounded }: {
	destructive?: boolean;
	text: string;
	unbounded: boolean;
}): ReactElement {
	return (
		<pre className={cn(
			"min-w-0 whitespace-pre-wrap break-words rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed",
			!unbounded && "max-h-56 overflow-auto",
			destructive && "border-destructive/30 bg-destructive/5 text-destructive",
		)}>
			{text}
		</pre>
	);
}

function stringifyInput(input: Record<string, unknown>): string {
	if (Object.keys(input).length === 0) return "";
	try {
		return JSON.stringify(input, null, 2);
	} catch {
		return String(input);
	}
}
