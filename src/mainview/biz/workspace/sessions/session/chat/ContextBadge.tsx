import { type ReactElement, useMemo } from "react";
import type { PiOpenedSession, PiSessionTranscriptEntry } from "@shared/pi-contract";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@view/components/ui/hover-card";
import { Separator } from "@view/components/ui/separator";
import { cn } from "@view/lib/utils";

type ContextUsage = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
};

type ContextBadgeProps = {
	openedSession: PiOpenedSession;
};

export function ContextBadge({
	openedSession,
}: ContextBadgeProps): ReactElement | null {
	const model = openedSession.runtime.model;
	const contextWindow = model?.contextWindow ?? 0;
	const { latest: usage, cumulative } = useMemo(
		() => collectUsage(openedSession.transcript.entries),
		[openedSession.transcript.entries],
	);
	const contextTokens = usage?.totalTokens ?? 0;

	if (contextWindow === 0 && contextTokens === 0) {
		return null;
	}

	const utilizationRatio = contextWindow > 0 ? contextTokens / contextWindow : 0;
	const clampedPercent = Math.min(utilizationRatio * 100, 100);
	const utilizationText = `${(utilizationRatio * 100).toFixed(1)}%`;
	const remainingTokens = Math.max(contextWindow - contextTokens, 0);

	const level = utilizationRatio > 0.9
		? "danger"
		: utilizationRatio > 0.7 ? "warning" : "normal";

	return (
		<HoverCard closeDelay={120} openDelay={150}>
			<HoverCardTrigger asChild>
				<button
					aria-label="查看上下文使用情况"
					className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted"
					type="button"
				>
					<span className="h-1.5 w-10 overflow-hidden rounded-full bg-foreground/15">
						<span
							className={cn(
								"block h-full rounded-full transition-[width] duration-150",
								level === "danger" ? "bg-destructive" : level === "warning" ? "bg-primary" : "bg-muted-foreground",
							)}
							style={{ width: `${clampedPercent}%` }}
						/>
					</span>
					<span className={cn("tabular-nums", level === "danger" ? "text-destructive" : level === "warning" ? "text-foreground" : "text-muted-foreground")}>
						{contextWindow > 0 ? utilizationText : formatTokens(contextTokens)}
					</span>
				</button>
			</HoverCardTrigger>
			<HoverCardContent align="end" className="w-72 p-0" side="bottom">
				<div className="flex flex-col gap-2 px-3 py-2.5">
					<div className="flex items-center justify-between gap-4">
						<span className="flex items-center gap-1.5 font-medium">
							<span
								aria-hidden
								className={cn("size-1.5 rounded-full", level === "danger" ? "bg-destructive" : level === "warning" ? "bg-primary" : "bg-muted-foreground")}
							/>
							上下文用量
						</span>
						<span className="text-[13px] font-semibold tabular-nums">
							{contextWindow > 0
								? utilizationText
								: formatTokens(contextTokens)}
						</span>
					</div>
					{contextWindow > 0 ? (
						<div className="flex flex-col gap-1">
							<div
								aria-label="上下文占用比例"
								aria-valuemax={contextWindow}
								aria-valuemin={0}
								aria-valuenow={Math.min(contextTokens, contextWindow)}
								className="h-1.5 overflow-hidden rounded-full bg-muted"
								role="progressbar"
							>
								<div
									className={cn(
										"h-full rounded-full transition-[width] duration-150",
										level === "danger" ? "bg-destructive" : level === "warning" ? "bg-primary" : "bg-muted-foreground",
									)}
									style={{ width: `${clampedPercent}%` }}
								/>
							</div>
							<div className="flex items-center justify-between gap-4 text-[11px] tabular-nums text-muted-foreground">
								<span>
									已用 {formatTokens(contextTokens)} /{" "}
									{formatTokens(contextWindow)}
								</span>
								<span>剩余 {formatTokens(remainingTokens)}</span>
							</div>
						</div>
					) : null}
					<div className="flex items-center justify-between gap-4 text-[11px]">
						<span className="text-muted-foreground">模型</span>
						<span
							className="min-w-0 truncate font-medium"
							title={model?.name ?? undefined}
						>
							{model?.name ?? "未选择"}
						</span>
					</div>
				</div>
				{usage ? (
					<>
						<Separator />
						<UsageSection label="本轮用量" usage={usage} />
						<Separator />
						<UsageSection label="累计用量" usage={cumulative} withTotal />
					</>
				) : null}
			</HoverCardContent>
		</HoverCard>
	);
}

function collectUsage(entries: PiSessionTranscriptEntry[]): {
	latest: ContextUsage | null;
	cumulative: ContextUsage;
} {
	const cumulative: ContextUsage = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
	};
	let latest: ContextUsage | null = null;
	for (const { message } of entries) {
		if (message.role !== "assistant") continue;
		const { input, output, cacheRead, cacheWrite, totalTokens } = message.usage;
		cumulative.input += input;
		cumulative.output += output;
		cumulative.cacheRead += cacheRead;
		cumulative.cacheWrite += cacheWrite;
		cumulative.totalTokens += totalTokens;
		latest = { input, output, cacheRead, cacheWrite, totalTokens };
	}
	return { latest, cumulative };
}

function UsageSection({
	label,
	usage,
	withTotal = false,
}: {
	label: string;
	usage: ContextUsage;
	withTotal?: boolean;
}): ReactElement {
	const promptInput = usage.input + usage.cacheRead + usage.cacheWrite;
	return (
		<div className="flex flex-col gap-2 px-3 py-2.5">
			<div className="flex h-4 items-center gap-1.5">
				<span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />
				<span className="font-medium leading-4">{label}</span>
			</div>
			<div className="flex flex-col gap-1">
				<UsageRow label="输入" tokens={promptInput} />
				<UsageRow label="未缓存输入" tokens={usage.input} indent muted />
				<UsageRow label="缓存读取" tokens={usage.cacheRead} indent muted />
				<UsageRow label="缓存写入" tokens={usage.cacheWrite} indent muted />
				<Separator className="my-1" />
				<UsageRow label="输出" tokens={usage.output} />
				{withTotal ? (
					<>
						<Separator className="my-1" />
						<UsageRow label="合计" tokens={usage.totalTokens} />
					</>
				) : null}
			</div>
		</div>
	);
}

function UsageRow({
	label,
	tokens,
	indent = false,
	muted = false,
}: {
	label: string;
	tokens: number;
	indent?: boolean;
	muted?: boolean;
}): ReactElement {
	return (
		<div className="flex items-baseline justify-between gap-6">
			<span
				className={cn(
					indent && "pl-3",
					muted ? "text-muted-foreground" : "font-medium text-foreground",
				)}
			>
				{label}
			</span>
			<TokenValue muted={muted} tokens={tokens} />
		</div>
	);
}

function formatTokens(tokens: number): string {
	if (tokens >= 1000) {
		const value = tokens / 1000;
		return value % 1 === 0 ? `${value.toFixed(0)}K` : `${value.toFixed(1)}K`;
	}
	return tokens.toString();
}

function TokenValue({
	tokens,
	muted = false,
}: {
	tokens: number;
	muted?: boolean;
}): ReactElement {
	const exact = tokens.toLocaleString("zh-CN");
	const thousands = Math.round(tokens / 1000).toLocaleString("zh-CN");
	return (
		<span className={cn("tabular-nums", muted ? "text-muted-foreground" : "text-foreground")}>
			<span>{exact}</span>
			<span className={cn("ml-2", muted ? "text-muted-foreground/70" : "text-muted-foreground")}>
				[{thousands}K]
			</span>
		</span>
	);
}
