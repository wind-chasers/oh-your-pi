import { describe, expect, test } from "bun:test";
import { resolveCodeLanguage, resolveFileLanguage } from "./syntax-languages";
import { highlightCode } from "./syntax-highlighting";

describe("syntax highlighting", () => {
	test("resolves Markdown aliases and workspace file names", () => {
		expect(resolveCodeLanguage("language-ts")).toBe("typescript");
		expect(resolveCodeLanguage("c++")).toBe("cpp");
		expect(resolveFileLanguage("src/components/App.tsx")).toBe("tsx");
		expect(resolveFileLanguage("infra/Dockerfile.dev")).toBe("dockerfile");
		expect(resolveFileLanguage("config/.env.local")).toBe("dotenv");
		expect(resolveFileLanguage("assets/image.png")).toBeUndefined();
	});

	test("returns text-preserving tokens for both color themes", async () => {
		const code = "const answer: number = 42;";
		const result = await highlightCode(code, "ts");
		const renderedText = result?.tokens
			.map((line) => line.map((token) => token.content).join(""))
			.join("\n");
		const themedToken = result?.tokens
			.flat()
			.find((token) => token.htmlStyle?.["--shiki-light"] && token.htmlStyle["--shiki-dark"]);

		expect(renderedText).toBe(code);
		expect(themedToken).toBeDefined();
	});

	test("skips costly highlighting for oversized content", async () => {
		const result = await highlightCode("x".repeat(200_001), "typescript");
		expect(result).toBeUndefined();
	});
});
