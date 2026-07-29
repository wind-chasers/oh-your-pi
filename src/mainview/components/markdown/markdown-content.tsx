import { type ComponentPropsWithoutRef, isValidElement, memo, type ReactElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@view/lib/utils";
import { CodeBlock, MermaidBlock } from "./markdown-code-block";
import "./markdown-content.scss";

type MarkdownContentProps = {
	children: string;
	className?: string;
	stable?: boolean;
};

type MarkdownLinkProps = ComponentPropsWithoutRef<"a"> & { node?: unknown };
type MarkdownImageProps = ComponentPropsWithoutRef<"img"> & { node?: unknown };
type MarkdownTableProps = ComponentPropsWithoutRef<"table"> & { node?: unknown };
const stableMarkdownComponents = createMarkdownComponents(true);
const unStableMarkdownComponents = createMarkdownComponents(false);

export const MarkdownContent = memo(function MarkdownContent({
	children,
	className,
	stable = true,
}: MarkdownContentProps): ReactElement {
	const components = stable ? stableMarkdownComponents : unStableMarkdownComponents;
	return (
		<div className={cn("markdown-content", className)}>
			<ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
				{children}
			</ReactMarkdown>
		</div>
	);
});

function useCode(content: React.ReactNode) {
	if (isValidElement<ComponentPropsWithoutRef<"code">>(content) && content.type === "code") {
		const { children, className = '' } = content.props;
		const language = className.match(/(?:^|\s)language-([^\s]+)/)?.[1];
		const code = String(children ?? "").replace(/\n$/, "");
		const isMermaid = language?.trim().toLowerCase() === "mermaid";
		return { code, language, isMermaid, className };
	}
}

function createMarkdownComponents(stable: boolean): Components {
	return {
		a: MarkdownLink,
		img: MarkdownImage,
		pre: ({ children, node: _node, ...props }) => {
			const result = useCode(children);
			if (!result) return <pre {...props}>{children}</pre>;

			const { code, language, isMermaid, className } = result;
			return isMermaid
				? <MermaidBlock code={code} preProps={props}>{children}</MermaidBlock>
				: <CodeBlock code={code} language={language} preProps={props} stable={stable} className={className} />;
		},
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
