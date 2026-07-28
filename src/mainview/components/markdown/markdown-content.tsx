import { type ComponentPropsWithoutRef, memo, type ReactElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@view/lib/utils";
import { MarkdownCodeBlock } from "./markdown-code-block";
import "./markdown-content.scss";

type MarkdownContentProps = {
	children: string;
	className?: string;
	codeHilight?: boolean;
};

type MarkdownLinkProps = ComponentPropsWithoutRef<"a"> & { node?: unknown };
type MarkdownImageProps = ComponentPropsWithoutRef<"img"> & { node?: unknown };
type MarkdownTableProps = ComponentPropsWithoutRef<"table"> & { node?: unknown };
const markdownComponentsWithHighlight = createMarkdownComponents(true);
const markdownComponentsWithoutHighlight = createMarkdownComponents(false);

export const MarkdownContent = memo(function MarkdownContent({
	children,
	className,
	codeHilight = true,
}: MarkdownContentProps): ReactElement {
	const components = codeHilight ? markdownComponentsWithHighlight : markdownComponentsWithoutHighlight;
	return (
		<div className={cn("markdown-content", className)}>
			<ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
				{children}
			</ReactMarkdown>
		</div>
	);
});

function createMarkdownComponents(codeHilight: boolean): Components {
	return {
		a: MarkdownLink,
		img: MarkdownImage,
		pre: (props) => <MarkdownCodeBlock {...props} codeHilight={codeHilight} />,
		table: MarkdownTable,
	};
}

function MarkdownLink({ children, node: _node, ...props }: MarkdownLinkProps): ReactElement {
	return <a {...props} rel="noreferrer" target="_blank">{children}</a>;
}

function MarkdownImage({ alt, node: _node, ...props }: MarkdownImageProps): ReactElement {
	return <img {...props} alt={alt ?? ""} loading="lazy" />;
}

function MarkdownTable({ children, node: _node, ...props }: MarkdownTableProps): ReactElement {
	return <div className="markdown-table"><table {...props}>{children}</table></div>;
}
