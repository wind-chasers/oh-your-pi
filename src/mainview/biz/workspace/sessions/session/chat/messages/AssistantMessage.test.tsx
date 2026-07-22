import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMessage } from "./AssistantMessage";

test("将思考过程折叠在最终回复上方", () => {
	const html = renderToStaticMarkup(
		<AssistantMessage
			text="这是最终回复。"
			thinking="先分析用户的问题，再组织简洁准确的回答。"
		/>,
	);

	expect(html).toContain("先分析用户的问题，再组织简洁准确的回答。");
	expect(html).toContain("这是最终回复。");
	expect(html).toContain("truncate");
	expect(html.indexOf("先分析用户的问题，再组织简洁准确的回答。")).toBeLessThan(html.indexOf("这是最终回复。"));
	expect(html).not.toContain("<details open=\"\"");
});
