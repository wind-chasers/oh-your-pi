import { expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChatSession } from "@view/chat-store";

mock.module("electrobun/view", () => ({
	Electroview: {
		defineRPC: () => ({
			addMessageListener: () => undefined,
			removeMessageListener: () => undefined,
			request: {},
		}),
	},
}));

(globalThis as { window?: unknown }).window = {};

const [{ EditMessageProvider }, { UserMessage }] = await Promise.all([
	import("../../editing-message"),
	import("./UserMessage"),
]);

const session = { snapshot: { useIsIdle: () => false } } as ChatSession;

test("用户消息显示时间、复制和未启用的编辑操作", () => {
	const text = "可复制的用户消息。";
	const timestamp = Date.UTC(2026, 6, 29, 7, 35);
	const html = renderToStaticMarkup(
		<EditMessageProvider>
			<UserMessage
				data={{
					type: "user",
					entryId: "entry-1",
					messageIndex: 0,
					text,
					images: [],
					message: {
						role: "user",
						content: [{ type: "text", text }],
						timestamp,
					},
				}}
				session={session}
			/>
		</EditMessageProvider>,
	);

	expect(html).toContain('dateTime="2026-07-29T07:35:00.000Z"');
	expect(html).toContain("lucide-clock");
	expect(html).toContain('aria-label="复制消息"');
	expect(html).toContain('aria-label="编辑消息"');
	expect(html).toContain("disabled");
});
