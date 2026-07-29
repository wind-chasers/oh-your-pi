import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UserMessage } from "./UserMessage";

test("用户消息显示时间、复制和未启用的编辑操作", () => {
	const html = renderToStaticMarkup(
		<UserMessage
			images={[]}
			text="可复制的用户消息。"
			timestamp={Date.UTC(2026, 6, 29, 7, 35)}
		/>,
	);

	expect(html).toContain('dateTime="2026-07-29T07:35:00.000Z"');
	expect(html).toContain("lucide-clock");
	expect(html).toContain('aria-label="复制消息"');
	expect(html).toContain('aria-label="编辑消息"');
	expect(html).toContain("disabled");
});
