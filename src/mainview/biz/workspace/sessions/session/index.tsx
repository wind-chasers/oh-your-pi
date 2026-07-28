import { type ReactElement, useEffect, useRef } from "react";
import { useChatSession } from "@view/chat-store";
import { WorkspaceAtom } from "@view/states/current.atom";
import { ShowThinkingAtom } from "@view/states/preferences.atom";
import { ChatComposer } from "./chat/composer";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatTranscript } from "./chat/ChatTranscript";
import { ToolPermissionPrompt } from "./chat/ToolPermissionPrompt";

type SessionChatProps = {
	isFileTreeOpen: boolean;
	onToggleFileTree: () => void;
	sessionId: string;
	sessionPath: string;
	workspacePath: string;
};

export function SessionChat({
	isFileTreeOpen,
	onToggleFileTree,
	sessionId,
	sessionPath,
	workspacePath,
}: SessionChatProps): ReactElement {
	const [snapshot, session] = useChatSession(workspacePath, sessionId, sessionPath);
	const showThinking = ShowThinkingAtom.useData();
	const setWorkspace = WorkspaceAtom.useChange();
	const transcriptEndRef = useRef<HTMLDivElement>(null);
	const openedSession = snapshot.openedSession;
	const renderItems = session.view.items;
	const isStreaming = openedSession?.runtime.isStreaming ?? false;
	const sessionSummary = openedSession?.transcript.session;

	useEffect(() => {
		if (!sessionSummary) return;
		setWorkspace((current) => {
			if (!current || current.workspacePath !== sessionSummary.workspacePath) return current;
			const sessionIndex = current.sessions.findIndex(
				(candidate) => candidate.id === sessionSummary.id,
			);
			if (sessionIndex < 0 || current.sessions[sessionIndex] === sessionSummary) return current;
			const sessions = [...current.sessions];
			sessions[sessionIndex] = sessionSummary;
			return { ...current, sessions };
		});
	}, [sessionSummary, setWorkspace]);

	useEffect(() => {
		transcriptEndRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
	}, [
		renderItems.length,
		snapshot.pendingUserMessage,
		snapshot.streamedText,
		snapshot.thinkingText,
		snapshot.tools,
	]);

	if (!openedSession) {
		return (
			<section className="grid h-full min-h-0 place-items-center bg-background p-8">
				<p className={snapshot.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
					{snapshot.error ?? "正在加载 Pi 会话…"}
				</p>
			</section>
		);
	}

	const sessionTitle =
		openedSession.transcript.session.name ||
		openedSession.transcript.session.firstMessage ||
		"未命名会话";
	const pendingPermission = snapshot.permissionRequests[0];


	async function handleAbort(): Promise<void> {
		try {
			await session.abort();
		} catch {
			// ChatSession publishes the visible error into its snapshot.
		}
	}

	async function handleToolPermission(allowed: boolean): Promise<void> {
		if (!pendingPermission) return;
		try {
			await session.respondToPermission(pendingPermission.id, allowed);
		} catch {
			// ChatSession publishes the visible error into its snapshot.
		}
	}

	return (
		<section className="flex h-full min-h-0 flex-col bg-background">
			<ChatHeader
				entryCount={openedSession.transcript.messages.length}
				isFileTreeOpen={isFileTreeOpen}
				isStreaming={isStreaming}
				onAbort={handleAbort}
				onToggleFileTree={onToggleFileTree}
				title={sessionTitle}
			/>
			<ChatTranscript
				isStreaming={isStreaming}
				items={renderItems}
				pendingUserMessage={snapshot.pendingUserMessage ?? undefined}
				showThinking={showThinking}
				streamedText={snapshot.streamedText}
				thinkingText={snapshot.thinkingText}
				tools={snapshot.tools}
				transcriptEndRef={transcriptEndRef}
			/>
			{pendingPermission ? (
				<ToolPermissionPrompt
					onDecide={handleToolPermission}
					request={pendingPermission}
				/>
			) : null}
			<ChatComposer
				error={formatSessionError(snapshot.error)}
				isSending={snapshot.isSending}
				openedSession={openedSession}
				session={session}
			/>
		</section>
	);
}

function formatSessionError(message: string | null): string | undefined {
	if (!message) return undefined;
	if (/OAuth (auth derivation|refresh) failed for github-copilot/i.test(message)) {
		return "GitHub Copilot 登录已失效。请使用 Pi 的登录流程重新授权后重试。";
	}
	return message;
}
