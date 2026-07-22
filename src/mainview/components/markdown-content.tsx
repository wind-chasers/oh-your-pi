import { type ComponentPropsWithoutRef, type ReactElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { cn } from "@view/lib/utils";
import "./markdown-content.scss";

type MarkdownContentProps = {
	children: string;
	className?: string;
};

type MarkdownLinkProps = ComponentPropsWithoutRef<"a"> & { node?: unknown };
type MarkdownImageProps = ComponentPropsWithoutRef<"img"> & { node?: unknown };
type MarkdownTableProps = ComponentPropsWithoutRef<"table"> & { node?: unknown };

const markdownComponents = {
	a: MarkdownLink,
	img: MarkdownImage,
	table: MarkdownTable,
} satisfies Components;


export function MarkdownContent({ children, className }: MarkdownContentProps): ReactElement {
	return (
		<div className={cn("markdown-content", className)}>
			<ReactMarkdown components={markdownComponents} rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
				{children}
			</ReactMarkdown>
		</div>
	);
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
