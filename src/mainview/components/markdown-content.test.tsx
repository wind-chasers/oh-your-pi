import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "./markdown-content";

function renderMarkdown(markdown: string): string {
	return renderToStaticMarkup(<MarkdownContent>{markdown}</MarkdownContent>);
}

describe("MarkdownContent", () => {
	test("renders GFM, syntax-highlighted code, and safe external links", () => {
		const html = renderMarkdown("# 标题\n\n- [x] 完成\n- [ ] 待办\n\n| 名称 | 值 |\n| --- | --- |\n| Pi | 3.14 |\n\n```ts\nconst answer = 42;\n```\n\n[文档](https://example.com)");

		expect(html).toContain("<h1>标题</h1>");
		expect(html).toContain("<input type=\"checkbox\" disabled=\"\" checked=\"\"/>");
		expect(html).toContain("<table");
		expect(html).toContain("hljs");
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noreferrer"');
		expect(html).not.toContain("node=");
	});

	test("does not render raw HTML as executable markup", () => {
		const html = renderMarkdown("<script>alert('xss')</script>");

		expect(html).not.toContain("<script>");
		expect(html).toContain("alert");
	});
});
