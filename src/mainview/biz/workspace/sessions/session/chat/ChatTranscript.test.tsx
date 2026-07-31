import { expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChatSession, ChatTranscriptTail } from "@view/chat-store";
import type { SessionViewItem } from "@view/chat-store/session-view";
import { TooltipProvider } from "@view/components/ui/tooltip";

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

const { ChatTranscript } = await import("./ChatTranscript");
const session = { snapshot: { useIsIdle: () => false } } as ChatSession;

function renderTail(tail: ChatTranscriptTail): string {
	return renderToStaticMarkup(
		<TooltipProvider>
			<ChatTranscript
				isStreaming={tail.type === "live-agent"}
				items={[]}
				showThinking
				session={session}
				tail={tail}
			/>
		</TooltipProvider>,
	);
}

test("optimistic user 同时显示文本与图片预览", () => {
	const html = renderTail({
		type: "optimistic-user",
		message: {
			clientId: "client-1",
			text: "看看这张图",
			images: [{ id: "image-1", alt: "截图", src: "data:image/webp;base64,aW1hZ2U=" }],
		},
	});

	expect(html).toContain("已发送");
	expect(html).toContain("看看这张图");
	expect(html).toContain("data:image/webp;base64,aW1hZ2U=");
});

test("live agent 输出作为一个临时尾部渲染", () => {
	const html = renderTail({
		type: "live-agent",
		output: {
			phase: "streaming",
			text: "正在处理",
			thinking: "先检查状态",
			tools: [],
			permissionRequests: [],
		},
	});

	expect(html).toContain("正在处理");
	expect(html).toContain("先检查状态");
});

test("持久工具章节不会被后续 live tail 标记为执行中", () => {
	const item: SessionViewItem = {
		type: "tool-section",
		sectionKey: "tool-section:assistant-1",
		firstMessageIndex: 0,
		lastMessageIndex: 0,
		toolCalls: [{
			id: "tool-1",
			name: "custom-tool",
			input: {},
			output: null,
			isError: null,
			ownerMessageIndex: 0,
			resultMessageIndex: null,
			executionStatus: null,
		}],
	};
	const html = renderToStaticMarkup(
		<TooltipProvider>
			<ChatTranscript
				isStreaming
				items={[item]}
				showThinking
				session={session}
				tail={{
					type: "live-agent",
					output: {
						phase: "streaming",
						text: "",
						thinking: "",
						tools: [],
						permissionRequests: [],
					},
				}}
			/>
		</TooltipProvider>,
	);

	expect(html).toContain("custom-tool，已中断");
	expect(html).not.toContain("custom-tool，执行中");
});
