import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FilePreview } from "./FilePreview";

function extractCodeText(html: string): string | undefined {
	const codeMarkup = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1];
	return codeMarkup?.replace(/<[^>]+>/g, "");
}

describe("FilePreview", () => {
	test("selects a syntax grammar from the file path while preserving source text", () => {
		const content = "export const answer: number = 42;\nexport const next = 43;\n";
		const html = renderToStaticMarkup(
			<FilePreview
				file={{
					content,
					isBinary: false,
					isTruncated: false,
					path: "src/answer.ts",
				}}
				onClose={() => undefined}
			/>,
		);

		expect(html).toContain('data-language="typescript"');
		expect(html).toContain("export const answer: number = 42;");
		expect(html).toContain('data-line="1"');
		expect(html).toContain('data-line="2"');
		expect(extractCodeText(html)).toBe(content);
	});

	test("falls back to plain code for files beyond the interactive line limit", () => {
		const content = Array.from({ length: 2_001 }, (_, index) => `line ${index + 1}`).join("\n");
		const html = renderToStaticMarkup(
			<FilePreview
				file={{ content, isBinary: false, isTruncated: false, path: "large.txt" }}
				onClose={() => undefined}
			/>,
		);

		expect(html).toContain("line 2001");
		expect(html).not.toContain("data-line=");
	});
});
