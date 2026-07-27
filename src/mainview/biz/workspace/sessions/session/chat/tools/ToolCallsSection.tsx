import {
	Check,
	ChevronRight,
	CircleX,
	LoaderCircle,
	ShieldQuestion,
	Wrench,
	X,
} from "lucide-react";
import { type ReactElement, useState } from "react";
import { Button } from "@view/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@view/components/ui/tooltip";
import { AnimatedHeight } from "./AnimatedHeight";
import { resolveToolRenderer } from "./registry";
import { ToolDetailView } from "./ToolDetailView";
import type {
	ToolCallExecutionStatus,
	ToolCallItem,
	ToolChipSlotProps,
} from "./types";

type ToolCallsSectionProps = {
	isLive?: boolean;
	toolCalls: readonly ToolCallItem[];
};

export function ToolCallsSection({ isLive = false, toolCalls }: ToolCallsSectionProps): ReactElement | null {
	const validCalls = toolCalls.filter((toolCall) => toolCall.id && toolCall.name);
	const [expanded, setExpanded] = useState(false);
	const [selectedId, setSelectedId] = useState<string>();
	if (validCalls.length === 0) return null;

	if (expanded) {
		return (
			<AnimatedHeight className="min-w-0 transition-[height] duration-200 ease-out max-w-[90%]" duration={200} isLive={isLive}>
				<section aria-label="全部工具调用" className="flex min-w-0 flex-col gap-2.5 rounded-lg border bg-muted/20 p-3">
					<header className="flex items-center gap-2">
						<Wrench aria-hidden className="size-3.5 text-muted-foreground" />
						<h3 className="text-xs font-medium">工具调用</h3>
						<span className="text-xs text-muted-foreground">{validCalls.length}</span>
						<Button aria-label="收起全部工具调用" className="ml-auto" onClick={() => setExpanded(false)} size="icon-xs" type="button" variant="ghost">
							<X />
						</Button>
					</header>
					<div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
						{validCalls.map((toolCall) => {
							const executionStatus = getExecutionStatus(toolCall, isLive);
							return (
								<article className="flex min-w-0 flex-col gap-2 rounded-md border bg-card p-2.5" key={toolCall.id}>
									<div className="flex min-w-0 items-center gap-2">
										<StatusIcon status={executionStatus} isError={toolCall.isError === true} />
										<span className="truncate text-sm font-medium">{labelFor(toolCall)}</span>
										<span className="ml-auto text-xs text-muted-foreground">{statusLabel(executionStatus, toolCall.isError === true)}</span>
									</div>
									<ToolDetailView executionStatus={executionStatus} toolCall={toolCall} unbounded />
								</article>
							);
						})}
					</div>
				</section>
			</AnimatedHeight>
		);
	}

	const selected = validCalls.find((toolCall) => toolCall.id === selectedId);
	return (
		<AnimatedHeight className="min-w-0 transition-[height] duration-200 ease-out border rounded border-dashed bg-muted/35 max-w-[90%]" duration={200} isLive={isLive}>
			<section aria-label="工具调用" className="flex min-w-0 flex-col gap-2 p-2">
				<div className="flex min-w-0 gap-1.5">
					<div className="h-6 flex shrink-0 items-center text-muted-foreground">
						<Wrench aria-hidden className="size-3.5" />
					</div>
					<div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
						{validCalls.map((toolCall) => (
							<ToolChip
								executionStatus={getExecutionStatus(toolCall, isLive)}
								key={toolCall.id}
								onClick={() => setSelectedId((current) => current === toolCall.id ? undefined : toolCall.id)}
								selected={selectedId === toolCall.id}
								toolCall={toolCall}
							/>
						))}
					</div>
					{validCalls.length > 1 && (
						<Button onClick={() => setExpanded(true)} size="xs" type="button" variant="ghost">
							<span>全部</span>
							<ChevronRight data-icon="inline-end" />
						</Button>
					)}
				</div>
				{selected ? (
					<div className="rounded-lg border bg-card p-3">
						<ToolDetailView executionStatus={getExecutionStatus(selected, isLive)} toolCall={selected} />
					</div>
				) : null}
			</section>
		</AnimatedHeight>
	);
}

function ToolChip(props: ToolChipSlotProps): ReactElement {
	const renderer = resolveToolRenderer(props.toolCall.name);
	if (renderer?.Chip) {
		const Chip = renderer.Chip;
		return <Chip {...props} />;
	}
	const label = renderer?.getLabel?.(props.toolCall) || props.toolCall.name;
	const status = statusLabel(props.executionStatus, props.toolCall.isError === true);
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label={`${label}，${status}`}
					aria-pressed={props.selected}
					className="max-w-64"
					onClick={props.onClick}
					size="xs"
					type="button"
					variant={props.selected ? "secondary" : "outline"}
				>
					<StatusIcon status={props.executionStatus} isError={props.toolCall.isError === true} />
					<span className="truncate">{label}</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="top">{status}</TooltipContent>
		</Tooltip>
	);
}

function StatusIcon({ isError, status }: { isError: boolean; status: ToolCallExecutionStatus }): ReactElement {
	if (status === "awaiting_permission") return <ShieldQuestion aria-hidden />;
	if (status === "running") return <LoaderCircle aria-hidden className="motion-safe:animate-spin" />;
	if (status === "interrupted" || isError) return <CircleX aria-hidden className="text-destructive" />;
	return <Check aria-hidden className="text-muted-foreground" />;
}

function labelFor(toolCall: ToolCallItem): string {
	return resolveToolRenderer(toolCall.name)?.getLabel?.(toolCall) || toolCall.name;
}

function statusLabel(status: ToolCallExecutionStatus, isError: boolean): string {
	if (status === "awaiting_permission") return "等待授权";
	if (status === "running") return "执行中";
	if (status === "interrupted") return "已中断";
	return isError ? "失败" : "已完成";
}

function getExecutionStatus(toolCall: ToolCallItem, isLive: boolean): ToolCallExecutionStatus {
	if (toolCall.executionStatus) return toolCall.executionStatus;
	if (toolCall.output !== null) return "completed";
	return isLive ? "running" : "interrupted";
}
