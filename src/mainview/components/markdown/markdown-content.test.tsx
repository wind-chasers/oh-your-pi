import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "@view/components/ui/tooltip";
import { MarkdownContent } from "./markdown-content";

function renderMarkdown(markdown: string, { stable = true }: { stable?: boolean } = {}): string {
	return renderToStaticMarkup(
		<TooltipProvider><MarkdownContent stable={stable}>{markdown}</MarkdownContent></TooltipProvider>,
	);
}

describe("MarkdownContent", () => {
	test("renders GFM, prepares code highlighting, and secures external links", () => {
		const html = renderMarkdown("# 标题\n\n- [x] 完成\n- [ ] 待办\n\n| 名称 | 值 |\n| --- | --- |\n| Pi | 3.14 |\n\n```ts\nconst answer = 42;\n```\n\n[文档](https://example.com)");

		expect(html).toContain("<h1>标题</h1>");
		expect(html).toContain("<input type=\"checkbox\" disabled=\"\" checked=\"\"/>");
		expect(html).toContain("<table");
		expect(html).toContain('data-language="typescript"');
		expect(html).toContain('data-slot="markdown-code-header"');
		expect(html).toContain('data-line="1"');
		expect(html).toContain('title="typescript">typescript</span>');
		expect(html).toContain('aria-label="复制代码"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noreferrer"');
		expect(html).not.toContain("node=");
	});

	test("uses native code inline and the code view only for blocks", () => {
		const block = renderMarkdown("```ts\nconst first = 1;\nconst second = 2;\n```");
		const plainBlock = renderMarkdown("```\nplain block\n```");
		const inline = renderMarkdown("Use `const value = 1` inline.");

		expect(block).toContain('data-line="2"');
		expect(plainBlock).toContain('data-line="1"');
		expect(plainBlock).toContain('title="text">text</span>');
		expect(inline).toContain("<code>const value = 1</code>");
		expect(inline).not.toContain('data-slot="markdown-code-header"');
		expect(inline).not.toContain("data-language=");
	});

	test("renders Mermaid diagrams when stable and keeps unstable Mermaid as source", () => {
		const diagram = renderMarkdown("```mermaid\nflowchart LR\n  A[开始] --> B[结束]\n```");
		const source = renderMarkdown("```mermaid\nflowchart LR\n  A --> B\n```", { stable: false });

		expect(diagram).toContain('data-slot="mermaid-diagram"');
		expect(diagram).toContain('aria-label="查看 Mermaid 源码"');
		expect(diagram).toContain('title="mermaid">mermaid</span>');
		expect(diagram).toContain('aria-label="放大 5%"');
		expect(diagram).toContain('aria-label="缩小 5%"');
		expect(diagram).toContain('aria-label="重置为 100%"');
		expect(diagram).toContain('aria-label="启用抓手平移"');
		expect(source).not.toContain('data-slot="mermaid-diagram"');
		expect(source).toContain('<code class="language-mermaid">flowchart LR');
	});

	test("does not render raw HTML as executable markup", () => {
		const html = renderMarkdown("<script>alert('xss')</script>");

		expect(html).not.toContain("<script>");
		expect(html).toContain("alert");
	});
});
