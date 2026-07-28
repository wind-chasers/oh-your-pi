import { Check, CircleX, Copy } from "lucide-react";
import {
	type ComponentPropsWithoutRef,
	isValidElement,
	type ReactElement,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import { Button } from "@view/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@view/components/ui/tooltip";
import { resolveCodeLanguage } from "../code-view/syntax-languages";
import { SyntaxHighlightedCode } from "../code-view/syntax-highlighted-code";

const COPY_STATUS_DURATION_MS = 2_000;

type CopyStatus = "idle" | "copied" | "failed";
type MarkdownCodeElementProps = ComponentPropsWithoutRef<"code">;
type MarkdownPreProps = ComponentPropsWithoutRef<"pre"> & { node?: unknown };
type MarkdownCodeBlockProps = MarkdownPreProps & { codeHilight: boolean };

type CopyState = {
	code: string;
	status: CopyStatus;
};

type MarkdownCodeHeaderProps = {
	code: string;
	languageLabel: string;
};

export function MarkdownCodeBlock({
	children,
	codeHilight,
	node: _node,
	...preProps
}: MarkdownCodeBlockProps): ReactElement {
	const codeElement = getCodeElement(children);
	if (!codeElement) return <pre {...preProps}>{children}</pre>;

	const { children: codeChildren, className } = codeElement.props;
	const language = className?.match(/(?:^|\s)language-([^\s]+)/)?.[1];
	const code = String(codeChildren ?? "").replace(/\n$/, "");

	return (
		<div className="markdown-code-block">
			<MarkdownCodeHeader code={code} languageLabel={getLanguageLabel(language)} />
			<pre {...preProps}>
				<SyntaxHighlightedCode
					className={className}
					enabled={codeHilight}
					language={language}
					showLineNumbers
				>
					{code}
				</SyntaxHighlightedCode>
			</pre>
		</div>
	);
}

function MarkdownCodeHeader({ code, languageLabel }: MarkdownCodeHeaderProps): ReactElement {
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

function getCodeElement(children: ReactNode): ReactElement<MarkdownCodeElementProps> | undefined {
	return isValidElement<MarkdownCodeElementProps>(children) && children.type === "code" ? children : undefined;
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
