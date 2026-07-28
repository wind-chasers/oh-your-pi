import { type CSSProperties, Fragment, memo, type MouseEvent, type ReactElement, type ReactNode, useEffect, useState } from "react";
import { cn } from "@view/lib/utils";
import { resolveCodeLanguage } from "./syntax-languages";
import type { HighlightedCodeResult } from "./syntax-highlighting";
import "./syntax-highlighted-code.scss";

const MAX_INTERACTIVE_LINES = 2_000;

type SyntaxHighlightedCodeProps = {
	children: string;
	className?: string;
	enabled?: boolean;
	language?: string;
	showLineNumbers?: boolean;
};

type HighlightState = {
	code: string;
	language: string;
	result: HighlightedCodeResult;
};

type CodeToken = HighlightedCodeResult["tokens"][number][number];
type CodeLine = CodeToken[] | string;

export const SyntaxHighlightedCode = memo(function SyntaxHighlightedCode({
	children,
	className,
	enabled = true,
	language,
	showLineNumbers = false,
}: SyntaxHighlightedCodeProps): ReactElement {
	const resolvedLanguage = resolveCodeLanguage(language);
	const [highlightState, setHighlightState] = useState<HighlightState>();
	const highlighted = enabled
		&& highlightState?.code === children
		&& highlightState.language === resolvedLanguage
		? highlightState.result
		: undefined;
	const lines = showLineNumbers && enabled && hasAtMostLines(children, MAX_INTERACTIVE_LINES)
		? getCodeLines(children, highlighted)
		: undefined;
	const lineNumberStyle = lines
		? { "--code-line-number-digits": String(lines.length).length } as CSSProperties
		: undefined;
	let codeContent: ReactNode = children;
	if (lines) codeContent = <CodeLines lines={lines} />;
	else if (highlighted) codeContent = <HighlightedTokens result={highlighted} />;

	useEffect(() => {
		if (!enabled || !resolvedLanguage) return;
		let active = true;
		void import("./syntax-highlighting")
			.then(({ highlightCode }) => highlightCode(children, resolvedLanguage))
			.then(
				(result) => {
					if (active && result) setHighlightState({ code: children, language: resolvedLanguage, result });
				},
				() => undefined,
			);
		return () => {
			active = false;
		};
	}, [children, enabled, resolvedLanguage]);

	return (
		<code
			className={cn(className, (highlighted || lines) && "syntax-highlighted-code")}
			data-language={resolvedLanguage}
			style={lineNumberStyle}
		>
			{codeContent}
		</code>
	);
});

function CodeLines({ lines }: { lines: CodeLine[] }): ReactElement {
	return (
		<>
			{lines.map((line, lineIndex) => (
				<Fragment key={lineIndex}>
					<span
						className="syntax-highlighted-line"
						data-line={lineIndex + 1}
						onClick={focusCodeLine}
						tabIndex={-1}
					>
						{typeof line === "string"
							? line
							: line.map((token, tokenIndex) => <CodeTokenSpan key={tokenIndex} token={token} />)}
					</span>
					{lineIndex < lines.length - 1 ? "\n" : null}
				</Fragment>
			))}
		</>
	);
}

function HighlightedTokens({ result }: { result: HighlightedCodeResult }): ReactElement {
	return (
		<>
			{result.tokens.map((line, lineIndex) => (
				<Fragment key={lineIndex}>
					{line.map((token, tokenIndex) => <CodeTokenSpan key={tokenIndex} token={token} />)}
					{lineIndex < result.tokens.length - 1 ? "\n" : null}
				</Fragment>
			))}
		</>
	);
}

function CodeTokenSpan({ token }: { token: CodeToken }): ReactElement {
	return <span className="syntax-highlighted-token" style={token.htmlStyle as CSSProperties}>{token.content}</span>;
}

function getCodeLines(code: string, highlighted?: HighlightedCodeResult): CodeLine[] {
	return highlighted?.tokens ?? code.split("\n");
}

function hasAtMostLines(code: string, maximum: number): boolean {
	let lineCount = 1;
	for (let index = 0; index < code.length; index += 1) {
		if (code.charCodeAt(index) !== 10) continue;
		lineCount += 1;
		if (lineCount > maximum) return false;
	}
	return true;
}

function focusCodeLine(event: MouseEvent<HTMLSpanElement>): void {
	event.currentTarget.focus({ preventScroll: true });
}
