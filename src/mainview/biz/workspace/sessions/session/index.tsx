import {
	type FormEvent,
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type PiOpenedSession,
	type PiSessionEvent,
	type PiToolPermissionRequest,
} from "@shared/pi-contract";
import {
	abortPiSession,
	followUpPiSession,
	promptPiSession,
	respondToPiToolPermission,
	steerPiSession,
	subscribeToPiSessionEvents,
	subscribeToPiToolPermissionRequests,
} from "@view/lib/pi-client";
import { AuthenticationAtom } from "@view/states/authentication.atom";
import { OpenedSessionAtom } from "@view/states/current.atom";
import { ShowThinkingAtom } from "@view/states/preferences.atom";
import { RefreshSessionMutation } from "@view/states/session";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatTranscript, type ToolStatus } from "./chat/ChatTranscript";
import { ToolPermissionPrompt } from "./chat/ToolPermissionPrompt";

type SessionChatProps = {
	isFileTreeOpen: boolean;
	onToggleFileTree: () => void;
};

type SessionChatContentProps = SessionChatProps & {
	openedSession: PiOpenedSession;
};

export function SessionChat(props: SessionChatProps): ReactElement | null {
	const openedSession = OpenedSessionAtom.useData();
	if (!openedSession) return null;
	return <SessionChatContent {...props} openedSession={openedSession} />;
}

function SessionChatContent({
	isFileTreeOpen,
	onToggleFileTree,
	openedSession,
}: SessionChatContentProps): ReactElement {
	const authentication = AuthenticationAtom.useData() ?? [];
	const showThinking = ShowThinkingAtom.useData();
	const refreshSession = RefreshSessionMutation.use();
	const setOpenedSession = OpenedSessionAtom.useChange();
	const [draft, setDraft] = useState("");
	const [error, setError] = useState<string>();
	const [isSending, setIsSending] = useState(false);
	const [isStreaming, setIsStreaming] = useState(
		openedSession.runtime.isStreaming,
	);
	const [pendingUserMessage, setPendingUserMessage] = useState<string>();
	const [streamedText, setStreamedText] = useState("");
	const [thinkingText, setThinkingText] = useState("");
	const [tools, setTools] = useState<Record<string, ToolStatus>>({});
	const [permissionRequests, setPermissionRequests] = useState<
		PiToolPermissionRequest[]
	>([]);
	const transcriptEndRef = useRef<HTMLDivElement>(null);
	const setStreaming = useCallback((nextValue: boolean): void => {
		setOpenedSession((current) => {
			if (!current || current.runtime.isStreaming === nextValue) return current;
			return {
				...current,
				runtime: { ...current.runtime, isStreaming: nextValue },
			};
		});
	}, [setOpenedSession]);
	const selectedModel = openedSession.runtime.model;
	const hasAvailableCredential = authentication.some((provider) => provider.status === "available");
	const hasAvailableModel =
		selectedModel !== null &&
		authentication.some(
			(provider) =>
				provider.provider === selectedModel.provider && provider.status === "available",
		);
	const sortedTools = useMemo(() => Object.entries(tools), [tools]);


	useEffect(() => {
		setIsStreaming(openedSession.runtime.isStreaming);
		setStreamedText("");
		setThinkingText("");
		setTools({});
		setPermissionRequests([]);
		setStreaming(openedSession.runtime.isStreaming);
	}, [openedSession.runtime.sessionPath, setStreaming]);

	useEffect(() => {
		transcriptEndRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
	}, [
		openedSession.transcript.entries.length,
		pendingUserMessage,
		streamedText,
		thinkingText,
		tools,
	]);

	useEffect(() => {
		function setStreamingState(nextValue: boolean): void {
			setIsStreaming(nextValue);
			setStreaming(nextValue);
		}

		function handleSessionEvent(event: PiSessionEvent): void {
			if (event.sessionPath !== openedSession.runtime.sessionPath) return;
			switch (event.type) {
				case "agent_start":
					setError(undefined);
					setStreamedText("");
					setThinkingText("");
					setTools({});
					setPermissionRequests([]);
					setStreamingState(true);
					return;
				case "assistant_text_delta":
					setStreamedText((text) => text + (event.text ?? ""));
					return;
				case "assistant_thinking_delta":
					setThinkingText((text) => text + (event.text ?? ""));
					return;
				case "tool_start":
					updateTool(event, "running");
					return;
				case "tool_end":
					updateTool(event, "complete");
					return;
				case "error":
					setError(formatSessionError(event.text));
					setPendingUserMessage(undefined);
					setStreamingState(false);
					return;
				case "agent_settled":
					setStreamingState(false);
					setPendingUserMessage(undefined);
					setStreamedText("");
					setThinkingText("");
					setTools({});
					setPermissionRequests([]);
					void refreshSession()
						.catch((refreshError: unknown) =>
							setError(toErrorMessage(refreshError, "无法刷新 Pi 会话。")),
						);
					return;
				default:
					return;
			}
		}

		function updateTool(
			event: PiSessionEvent,
			status: ToolStatus["status"],
		): void {
			if (!event.toolCallId || !event.toolName) return;
			setTools((current) => ({
				...current,
				[event.toolCallId!]: {
					isError:
						status === "complete" ? (event.isError ?? undefined) : undefined,
					name: event.toolName!,
					status,
				},
			}));
		}

		return subscribeToPiSessionEvents(handleSessionEvent);
	}, [openedSession.runtime.sessionPath, refreshSession, setStreaming]);

	useEffect(() => {
		function handleToolPermissionRequest(
			request: PiToolPermissionRequest,
		): void {
			if (request.sessionPath !== openedSession.runtime.sessionPath) return;
			setPermissionRequests((current) => [...current, request]);
			if (!request.toolCallId) return;
			setTools((current) => ({
				...current,
				[request.toolCallId!]: {
					isError: undefined,
					name: request.toolName,
					status: "awaiting_permission",
				},
			}));
		}

		return subscribeToPiToolPermissionRequests(handleToolPermissionRequest);
	}, [openedSession.runtime.sessionPath]);

	async function handleSubmit(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		const text = draft.trim();
		if (!text || isSending || !hasAvailableCredential || !hasAvailableModel) return;
		setError(undefined);
		setIsSending(true);
		try {
			if (isStreaming) {
				await steerPiSession({
					sessionPath: openedSession.runtime.sessionPath,
					text,
				});
			} else {
				setPendingUserMessage(text);
				setStreamedText("");
				setThinkingText("");
				setTools({});
				setPermissionRequests([]);
				setIsStreaming(true);
				setStreaming(true);
				await promptPiSession({
					sessionPath: openedSession.runtime.sessionPath,
					text,
				});
			}
			setDraft("");
		} catch (requestError) {
			setPendingUserMessage(undefined);
			setIsStreaming(false);
			setStreaming(false);
			setError(toErrorMessage(requestError, "无法发送消息。"));
		} finally {
			setIsSending(false);
		}
	}

	async function handleFollowUp(): Promise<void> {
		const text = draft.trim();
		if (!text || isSending || !isStreaming) return;
		setError(undefined);
		setIsSending(true);
		try {
			await followUpPiSession({
				sessionPath: openedSession.runtime.sessionPath,
				text,
			});
			setDraft("");
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法排队后续消息。"));
		} finally {
			setIsSending(false);
		}
	}

	async function handleAbort(): Promise<void> {
		setError(undefined);
		try {
			await abortPiSession({ sessionPath: openedSession.runtime.sessionPath });
			setIsStreaming(false);
			setStreaming(false);
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法停止 Pi 会话。"));
		}
	}

	async function handleToolPermission(
		request: PiToolPermissionRequest,
		allowed: boolean,
	): Promise<void> {
		setError(undefined);
		try {
			await respondToPiToolPermission({ allowed, id: request.id });
			setPermissionRequests((current) =>
				current.filter((candidate) => candidate.id !== request.id),
			);
			if (request.toolCallId && !allowed) updateDeniedTool(request);
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法提交工具授权决定。"));
		}
	}

	function updateDeniedTool(request: PiToolPermissionRequest): void {
		if (!request.toolCallId) return;
		setTools((current) => ({
			...current,
			[request.toolCallId!]: {
				isError: true,
				name: request.toolName,
				status: "complete",
			},
		}));
	}


	const sessionTitle =
		openedSession.transcript.session.name ||
		openedSession.transcript.session.firstMessage ||
		"未命名会话";
	const pendingPermission = permissionRequests[0];

	return (
		<section className="flex h-full min-h-0 flex-col bg-background">
			<ChatHeader
				entryCount={openedSession.transcript.entries.length}
				isFileTreeOpen={isFileTreeOpen}
				isStreaming={isStreaming}
				onAbort={handleAbort}
				onToggleFileTree={onToggleFileTree}
				title={sessionTitle}
			/>
			<ChatTranscript
				entries={openedSession.transcript.entries}
				isStreaming={isStreaming}
				pendingUserMessage={pendingUserMessage}
				showThinking={showThinking}
				streamedText={streamedText}
				thinkingText={thinkingText}
				tools={sortedTools}
				transcriptEndRef={transcriptEndRef}
			/>
			{pendingPermission ? (
				<ToolPermissionPrompt
					onDecide={(allowed) => handleToolPermission(pendingPermission, allowed)}
					request={pendingPermission}
				/>
			) : null}
			<ChatComposer
				draft={draft}
				error={error}
				hasAvailableCredential={hasAvailableCredential}
				hasAvailableModel={hasAvailableModel}
				isSending={isSending}
				isStreaming={isStreaming}
				onChange={setDraft}
				onFollowUp={handleFollowUp}
				onSubmit={handleSubmit}
			/>
		</section>
	);
}


function formatSessionError(message: string | null): string {
	if (!message) return "Pi 会话运行失败。";
	if (
		/OAuth (auth derivation|refresh) failed for github-copilot/i.test(message)
	) {
		return "GitHub Copilot 登录已失效。请使用 Pi 的登录流程重新授权后重试。";
	}
	return message;
}

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
