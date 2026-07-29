import { ChartNoAxesCombined, Check, CircleX, Code2, Copy } from "lucide-react";
import {
	type ComponentPropsWithoutRef,
	type ReactElement,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import { Button } from "@view/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@view/components/ui/tooltip";
import { resolveCodeLanguage } from "../code-view/syntax-languages";
import { SyntaxHighlightedCode } from "../code-view/syntax-highlighted-code";
import { MermaidDiagram, MermaidViewportControls, useMermaidViewport } from "@view/components/mermaid";

const COPY_STATUS_DURATION_MS = 2_000;

type CopyStatus = "idle" | "copied" | "failed";
type MarkdownPreProps = ComponentPropsWithoutRef<"pre"> & { node?: unknown };
type MarkdownCodeBlockProps = {
	code: string;
	language?: string;
	preProps: MarkdownPreProps;
	stable?: boolean;
	className?: string;
};

type CopyState = {
	code: string;
	status: CopyStatus;
};

type MarkdownCodeHeaderProps = {
	action?: ReactNode;
	code: string;
	languageLabel: string;
};

type MermaidCodeBlockProps = {
	code: string;
	preProps: MarkdownPreProps;
	children?: ReactNode;
};

type MermaidView = "code" | "diagram";

export function CodeBlock({ code, language, stable, preProps, className }: MarkdownCodeBlockProps): ReactElement {
	return (
		<div className="markdown-code-block">
			<MarkdownCodeHeader code={code} languageLabel={getLanguageLabel(language)} />
			<pre {...preProps}>
				<SyntaxHighlightedCode
					className={className}
					enabled={stable}
					language={language}
					showLineNumbers
				>
					{code}
				</SyntaxHighlightedCode>
			</pre>
		</div>
	);
}

export function MermaidBlock({ code, children, preProps }: MermaidCodeBlockProps): ReactElement {
	const [view, setView] = useState<MermaidView>("diagram");
	const isDiagram = view === "diagram";
	const toggleLabel = isDiagram ? "查看 Mermaid 源码" : "查看 Mermaid 图表";
	const { panEnabled, reset, togglePan, viewport, zoom, zoomIn, zoomOut } = useMermaidViewport();

	return (
		<div className="markdown-code-block">
			<MarkdownCodeHeader
				action={
					<>
						{isDiagram && (
							<MermaidViewportControls
								panEnabled={panEnabled}
								onReset={reset}
								onTogglePan={togglePan}
								onZoomIn={zoomIn}
								onZoomOut={zoomOut}
								zoom={zoom}
							/>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									aria-label={toggleLabel}
									aria-pressed={isDiagram}
									onClick={() => setView((current) => current === "diagram" ? "code" : "diagram")}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									{isDiagram ? <Code2 aria-hidden /> : <ChartNoAxesCombined aria-hidden />}
								</Button>
							</TooltipTrigger>
							<TooltipContent showArrow={false} side="top">{toggleLabel}</TooltipContent>
						</Tooltip>
					</>
				}
				code={code}
				languageLabel={getLanguageLabel('mermaid')}
			/>
			{isDiagram ? (
				<MermaidDiagram code={code} viewport={viewport} />
			) : (
				<pre {...preProps}>{children}</pre>
			)}
		</div>
	);
}

function MarkdownCodeHeader({ action, code, languageLabel }: MarkdownCodeHeaderProps): ReactElement {
	const [copyState, setCopyState] = useState<CopyState>({ code, status: "idle" });
	const copyStatus = copyState.code === code ? copyState.status : "idle";
	const copyLabel = getCopyLabel(copyStatus);

	useEffect(() => {
		if (copyStatus === "idle") return;
		const timeout = window.setTimeout(() => {
			setCopyState({ code, status: "idle" });
		}, COPY_STATUS_DURATION_MS);
		return () => window.clearTimeout(timeout);
	}, [code, copyStatus]);

	async function copyCode(): Promise<void> {
		try {
			await navigator.clipboard.writeText(code);
			setCopyState({ code, status: "copied" });
		} catch {
			setCopyState({ code, status: "failed" });
		}
	}
	return (
		<div
			className="flex min-h-8 items-center justify-between gap-2 border-b border-border/70 bg-muted/20 py-0.5 pr-1.5 pl-3 text-muted-foreground"
			data-slot="markdown-code-header"
		>
			<span
				className="min-w-0 truncate font-mono text-sm font-medium leading-4"
				data-slot="markdown-code-language"
				title={languageLabel}
			>
				{languageLabel}
			</span>
			<div className="flex items-center gap-1">
				{action}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							aria-label={copyLabel}
							onClick={() => void copyCode()}
							size="icon-xs"
							type="button"
							variant="ghost"
						>
							<CopyStatusIcon status={copyStatus} />
						</Button>
					</TooltipTrigger>
					<TooltipContent showArrow={false} side="top">
						{copyLabel}
					</TooltipContent>
				</Tooltip>
			</div>
			<span aria-live="polite" className="sr-only">
				{copyStatus === "idle" ? "" : copyLabel}
			</span>
		</div>
	);
}

function CopyStatusIcon({ status }: { status: CopyStatus }): ReactElement {
	if (status === "copied") return <Check aria-hidden />;
	if (status === "failed") return <CircleX aria-hidden />;
	return <Copy aria-hidden />;
}

function getLanguageLabel(language?: string): string {
	const normalized = language?.trim().toLowerCase();
	return resolveCodeLanguage(normalized) ?? (normalized || "text");
}

function getCopyLabel(status: CopyStatus): string {
	if (status === "copied") return "已复制";
	if (status === "failed") return "复制失败";
	return "复制代码";
}
