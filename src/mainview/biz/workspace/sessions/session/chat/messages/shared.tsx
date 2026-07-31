import { Check, CircleX, Clock, Copy } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { Button } from "@view/components/ui/button";
import { cn } from "@view/lib/utils";

const COPY_STATUS_DURATION_MS = 2_000;

type CopyStatus = "idle" | "copied" | "failed";

type CopyButtonProps = {
	content: string;
	noun: string;
	disabled?: boolean;
};

type MessageTimestampProps = {
	timestamp?: number;
  className?: string;
};

export function CopyButton({ content, disabled = false, noun }: CopyButtonProps): ReactElement {
	const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
	const copyLabel = getCopyLabel(copyStatus, noun);

	useEffect(() => {
		if (copyStatus === "idle") return;
		const timeout = window.setTimeout(() => setCopyStatus("idle"), COPY_STATUS_DURATION_MS);
		return () => window.clearTimeout(timeout);
	}, [copyStatus]);

	async function copyContent(): Promise<void> {
		try {
			await navigator.clipboard.writeText(content);
			setCopyStatus("copied");
		} catch {
			setCopyStatus("failed");
		}
	}

	return (
		<>
			<Button
				aria-label={copyLabel}
				disabled={disabled}
				onClick={() => void copyContent()}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<CopyStatusIcon status={copyStatus} />
			</Button>
			<span aria-live="polite" className="sr-only">
				{copyStatus === "idle" ? "" : copyLabel}
			</span>
		</>
	);
}

export function MessageTimestamp({ timestamp, className }: MessageTimestampProps): ReactElement | null {
	const time = formatTimestamp(timestamp);
	if (!time || timestamp === undefined) return null;

	return (
		<time
      className={cn("inline-flex items-center gap-1 text-muted-foreground/70", className)}
      dateTime={new Date(timestamp).toISOString()} title={`消息时间：${time}`}
    >
			<Clock aria-hidden size={10} />{time}
		</time>
	);
}

function CopyStatusIcon({ status }: { status: CopyStatus }): ReactElement {
	if (status === "copied") return <Check aria-hidden />;
	if (status === "failed") return <CircleX aria-hidden />;
	return <Copy aria-hidden />;
}

function getCopyLabel(status: CopyStatus, noun: string): string {
	if (status === "copied") return `已复制${noun}`;
	if (status === "failed") return "复制失败，请重试";
	return `复制${noun}`;
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