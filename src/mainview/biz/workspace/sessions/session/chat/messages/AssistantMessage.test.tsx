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


test("流式回复复用助手消息并展示状态", () => {
	const html = renderToStaticMarkup(
		<AssistantMessage
			isStreaming
			text="正在生成的回复。"
			thinking="正在核对可用信息。"
		/>,
	);

	expect(html).toContain("回复中");
	expect(html).toContain("思考中");
	expect(html).toContain("正在生成的回复。");
	expect(html).toContain("正在核对可用信息。");
	expect(html).toContain(" open=\"\"");
});

test("空的流式回复保留思考中的反馈", () => {
	const html = renderToStaticMarkup(<AssistantMessage isStreaming text="" />);

	expect(html).toContain("正在思考…");
});
