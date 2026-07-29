import { type ReactElement, useEffect } from "react";
import { useChatSession } from "@view/chat-store";
import { WorkspaceAtom } from "@view/states/current.atom";
import { ShowThinkingAtom } from "@view/states/preferences.atom";
import { ChatComposer } from "./chat/composer";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatTranscript } from "./chat/ChatTranscript";
import { ToolPermissionPrompt } from "./chat/ToolPermissionPrompt";
import { EditMessageAtom } from './editing-message';

export * from './editing-message';

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
	const openedSession = snapshot.openedSession;
	const renderItems = session.view.items;
	const isStreaming = openedSession?.runtime.isStreaming ?? false;
	const sessionSummary = openedSession?.transcript.session;
	const editing = EditMessageAtom.useData();

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
	const { tail, queuedInputs } = snapshot.transient;

	return (
		<section className="flex h-full min-h-0 flex-col bg-background">
			<ChatHeader
				entryCount={openedSession.transcript.entries.length}
				isFileTreeOpen={isFileTreeOpen}
				isStreaming={isStreaming}
				session={session}
				onToggleFileTree={onToggleFileTree}
				openedSession={openedSession}
				title={sessionTitle}
			/>
			<ChatTranscript
				isStreaming={isStreaming}
				items={renderItems}
				showThinking={showThinking}
				tail={tail}
				editing={editing}
				session={session}
			/>
			{!editing && (
				<>
					<ToolPermissionPrompt session={session} tail={tail} />
					<ChatComposer
						error={snapshot.error}
						isSending={snapshot.isSending}
						openedSession={openedSession}
						session={session}
						queuedInputs={queuedInputs}
					/>
				</>
			)}
		</section>
	);
}
