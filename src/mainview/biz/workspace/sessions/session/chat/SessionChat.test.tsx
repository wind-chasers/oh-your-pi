import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
	PiAuthenticationStatus,
	PiConversationEntry,
	PiOpenedSession,
	PiSessionSummary,
} from "@shared/pi-contract";

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

// Dynamic loading is required so the Electrobun mock is installed first.
const { SessionChat } = await import("../index");

const session: PiSessionSummary = {
	id: "session-id",
	path: "/workspace/session.jsonl",
	workspacePath: "/workspace",
	name: "测试会话",
	firstMessage: "继续任务",
	messageCount: 1,
	modifiedAt: "2026-07-24T00:00:00.000Z",
};

const openedSession: PiOpenedSession = {
	runtime: {
		sessionId: "session-id",
		sessionPath: "/workspace/session.jsonl",
		isStreaming: false,
		sessionName: "测试会话",
		model: {
			provider: "test",
			id: "model-id",
			name: "Test model",
			reasoning: false,
		},
		models: [
			{
				provider: "test",
				id: "model-id",
				name: "Test model",
				reasoning: false,
			},
			{
				provider: "unavailable",
				id: "unavailable-model-id",
				name: "Unavailable model",
				reasoning: true,
			},
		],
		thinkingLevel: "off",
		availableThinkingLevels: ["off"],
	},
	transcript: {
		session,
		entries: [],
	},
};

const authentication: PiAuthenticationStatus[] = [{
	provider: "test",
	name: "Test provider",
	status: "available",
	type: "api_key",
	loginMethods: ["api_key"],
}];

const conversationEntries: PiConversationEntry[] = [
	{
		id: "user-entry",
		parentId: null,
		role: "user",
		text: "老铁，我又来了",
		timestamp: "2026-07-24T00:00:00.000Z",
	},
	{
		id: "assistant-entry",
		parentId: "user-entry",
		role: "assistant",
		text: "欢迎回来",
		timestamp: "2026-07-24T00:00:01.000Z",
	},
];

describe("SessionChat", () => {
	test("有可用模型时直接启用消息编辑器", () => {
		const html = renderToStaticMarkup(
			<SessionChat
				authentication={authentication}
				isFileTreeOpen={false}
				onOpenAuthentication={() => {}}
				onSessionUpdate={() => {}}
				onRefresh={async () => {}}
				onStreamingChange={() => {}}
				onToggleFileTree={() => {}}
				openedSession={openedSession}
				showThinking={false}
			/>
		);
		expect(html).toContain('aria-label="模型"');
		expect(html).toContain('aria-label="思考级别"');
		expect(html).not.toContain("Unavailable model");
		expect(html).toContain('data-slot="select-trigger"');

		const composer = html.match(
			/<textarea\b[^>]*aria-label="发送给 Pi 的消息"[^>]*>/,
		);
		expect(composer).not.toBeNull();
		expect(composer![0]).not.toContain('disabled=""');
		expect(composer![0]).toContain('rows="1"');
		expect(html).not.toContain("准备好接管此会话？");
	});

	test("用户与助手消息不显示冗余说话人标签", () => {
		const html = renderToStaticMarkup(
			<SessionChat
				authentication={authentication}
				isFileTreeOpen={false}
				onOpenAuthentication={() => {}}
				onRefresh={async () => {}}
				onSessionUpdate={() => {}}
				onStreamingChange={() => {}}
				onToggleFileTree={() => {}}
				openedSession={{
					...openedSession,
					transcript: {
						...openedSession.transcript,
						entries: conversationEntries,
					},
				}}
				showThinking={false}
			/>
		);

		expect(html).toContain("老铁，我又来了");
		expect(html).toContain("欢迎回来");
		expect(html).not.toContain(">你</p>");
		expect(html).not.toContain(">Pi</p>");
	});

	test("缺少凭据时显示连接提供商操作而非发送按钮", () => {
		const html = renderToStaticMarkup(
			<SessionChat
				authentication={[]}
				isFileTreeOpen={false}
				onOpenAuthentication={() => {}}
				onSessionUpdate={() => {}}
				onRefresh={async () => {}}
				onStreamingChange={() => {}}
				onToggleFileTree={() => {}}
				openedSession={openedSession}
				showThinking={false}
			/>,
		);

		expect(html).toContain("连接模型提供商");
		expect(html).not.toContain(">发送</button>");
	});
});
