import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
	PiAuthenticationStatus,
	PiOpenedSession,
	PiSessionMessage,
	PiSessionSummary,
} from "@shared/pi-contract";
import type { ReactElement } from "react";
import { WithStore } from "@view/atom";
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

// Dynamic loading is required so the Electrobun mock is installed first.
const [{ SessionChat, EditMessageProvider }, { AuthenticationAtom }, { chatStore }] = await Promise.all([
	import(".."),
	import("@view/states/authentication.atom"),
	import("@view/chat-store"),
]);

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
			contextWindow: 128_000,
			provider: "test",
			id: "model-id",
			name: "Test model",
			input: ["text", "image"],
			reasoning: false,
		},
		models: [
			{
				contextWindow: 128_000,
				provider: "test",
				id: "model-id",
				name: "Test model",
				input: ["text", "image"],
				reasoning: false,
			},
			{
				contextWindow: 64_000,
				provider: "unavailable",
				id: "unavailable-model-id",
				name: "Unavailable model",
				input: ["text"],
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

const usage = {
	cacheRead: 0,
	cacheWrite: 0,
	cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
	input: 0,
	output: 0,
	totalTokens: 0,
};

const conversationMessages: PiSessionMessage[] = [
	{
		role: "user",
		content: [{ type: "text", text: "老铁，我又来了" }],
		timestamp: 0,
	},
	{
		api: "test",
		provider: "test",
		model: "test",
		role: "assistant",
		content: [{ type: "text", text: "欢迎回来" }],
		stopReason: "stop",
		timestamp: 1,
		usage,
	},
];

function renderSessionChat(
	currentAuthentication: PiAuthenticationStatus[],
	currentSession: PiOpenedSession,
): string {
	chatStore
		.session(
			currentSession.transcript.session.workspacePath,
			currentSession.runtime.sessionId,
			currentSession.runtime.sessionPath,
		)
		.hydrate(currentSession);
	function Fixture(): ReactElement {
		AuthenticationAtom.useChange().setStatuses(currentAuthentication);
		return (
			<SessionChat
				isFileTreeOpen={false}
				onToggleFileTree={() => {}}
				sessionId={currentSession.runtime.sessionId}
				sessionPath={currentSession.runtime.sessionPath}
				workspacePath={currentSession.transcript.session.workspacePath}
			/>
		);
	}

	return renderToStaticMarkup(
		<TooltipProvider>
			<WithStore>
				<EditMessageProvider>
					<Fixture />
				</EditMessageProvider>
			</WithStore>
		</TooltipProvider>
	);
}

describe("SessionChat", () => {
	test("有可用模型时直接启用消息编辑器", () => {
		const html = renderSessionChat(authentication, openedSession);
		expect(html).toContain('aria-label="模型"');
		expect(html).toContain('aria-label="思考级别"');
		expect(html).not.toContain("Unavailable model");
		expect(html).toContain('data-slot="select-trigger"');
		expect(html).toContain('aria-label="添加图片附件"');

		const composer = html.match(
			/<textarea\b[^>]*aria-label="发送给 Pi 的消息"[^>]*>/,
		);
		expect(composer).not.toBeNull();
		expect(composer![0]).not.toContain('disabled=""');
		expect(composer![0]).toContain('rows="1"');
		expect(html).not.toContain("准备好接管此会话？");
	});
	test("不支持图像的模型禁用附件入口", () => {
		const html = renderSessionChat(authentication, {
			...openedSession,
			runtime: {
				...openedSession.runtime,
				model: openedSession.runtime.model
					? { ...openedSession.runtime.model, input: ["text"] }
					: undefined,
			},
		});
		const attachmentButton = html.match(
			/<button\b[^>]*aria-label="添加图片附件"[^>]*>/,
		);
		expect(attachmentButton).not.toBeNull();
		expect(attachmentButton![0]).toContain('disabled=""');
	});



	test("用户与助手消息不显示冗余说话人标签", () => {
		const html = renderSessionChat(authentication, {
			...openedSession,
			transcript: {
				...openedSession.transcript,
				entries: conversationMessages.map((message, index) => ({
					id: `entry-${index}`,
					parentId: index === 0 ? null : `entry-${index - 1}`,
					message,
				})),
			},
		});

		expect(html).toContain("老铁，我又来了");
		expect(html).toContain("欢迎回来");
		expect(html).not.toContain(">你</p>");
		expect(html).not.toContain(">Pi</p>");
	});

	test("缺少凭据时显示连接提供商操作而非发送按钮", () => {
		const html = renderSessionChat([], openedSession);

		expect(html).toContain("连接模型提供商");
		expect(html).not.toContain(">发送</button>");
	});
});
