import { castDraft, type Draft } from "immer";
import type {
	PiSessionEvent,
	PiToolPermissionRequest,
} from "@shared/pi-contract";
import { SessionSnapshot } from "./snapshot";
import type {
	ChatLiveAgentTail,
	ChatPendingUserMessage,
	ChatQueuedUserInput,
	ChatQueuedInputs,
	ChatSessionSnapshot,
	ChatToolExecutionStatus,
} from "./types";
const MAX_PENDING_INPUTS = 500;

export type PendingSessionInput =
	| { kind: "event"; value: PiSessionEvent }
	| { kind: "permission"; value: PiToolPermissionRequest };

export class SessionStream {
	private readonly pendingInputs: PendingSessionInput[] = [];
	private deferredLiveOutput: ChatLiveAgentTail | null = null;
	private revision = 0;

	public constructor(private readonly snapshot: SessionSnapshot) {}

	public get eventRevision(): number {
		return this.revision;
	}


	public beginPrompt(message: ChatPendingUserMessage): void {
		this.snapshot.edit((draft) => {
			draft.error = null;
			draft.transient.tail = castDraft({ type: "optimistic-user", message });
			this.deferredLiveOutput = null;
			this.setStreaming(draft, true);
		});
	}

	public failPrompt(): void {
		this.snapshot.edit((draft) => {
			if (draft.transient.tail.type === "optimistic-user") {
				draft.transient.tail = { type: "empty" };
			}
			this.deferredLiveOutput = null;
			this.setStreaming(draft, false);
		});
	}

	public beginQueuedInput(
		queue: keyof ChatQueuedInputs,
		input: ChatQueuedUserInput,
	): void {
		this.snapshot.edit((draft) => {
			draft.error = null;
			draft.transient.queuedInputs[queue].push(castDraft(input));
		});
	}

	public acceptQueuedInput(clientId: string): void {
		this.snapshot.edit((draft) => {
			const input = findQueuedInput(draft, clientId);
			if (input) input.state = "queued";
		});
	}

	public failQueuedInput(clientId: string): void {
		this.snapshot.edit((draft) => this.removeQueuedInputs(draft, [clientId]));
	}

	public finishAbort(): void {
		this.snapshot.edit((draft) => {
			draft.transient = {
				tail: { type: "empty" },
				queuedInputs: { steering: [], followUps: [] },
			};
			draft.error = null;
			if (draft.openedSession) draft.openedSession.runtime.isStreaming = false;
			this.deferredLiveOutput = null;
		});
	}

	public acceptEvent(event: PiSessionEvent): void {
		this.revision += 1;
		this.snapshot.edit((draft) => {
			switch (event.type) {
				case "agent_start":
					draft.error = null;
					this.setStreaming(draft, true);
					if (draft.transient.tail.type === "empty") {
						draft.transient.tail = castDraft({ type: "live-agent", output: createLiveAgentTail() });
					} else if (draft.transient.tail.type === "optimistic-user") {
						this.deferredLiveOutput = createLiveAgentTail();
					}
					break;
				case "text_delta":
					this.setStreaming(draft, true);
					this.ensureLiveOutput(draft).text += event.delta;
					break;
				case "thinking_delta":
					this.setStreaming(draft, true);
					this.ensureLiveOutput(draft).thinking += event.delta;
					break;
				case "tool_execution_start":
					this.setTool(draft, event.toolCallId, event.toolName, "running", null);
					break;
				case "tool_execution_end":
					this.setTool(
						draft,
						event.toolCallId,
						event.toolName,
						"completed",
						event.isError,
					);
					break;
				case "error":
					draft.error = event.errorMessage;
					this.setStreaming(draft, false);
					if (draft.transient.tail.type === "optimistic-user") {
						draft.transient.tail = { type: "empty" };
						this.deferredLiveOutput = null;
					} else {
						this.settleLiveOutput(draft);
					}
					break;
				case "transcript_entries_appended": {
					if (!draft.openedSession) throw new Error("Pi 会话尚未加载完成。");
					const transcript = draft.openedSession.transcript;
					transcript.entries.push(...event.entries);
					this.syncTranscriptSummary(
						draft,
						event.firstMessage,
						event.messageCount,
						event.modifiedAt,
					);
					if (
						draft.transient.tail.type === "optimistic-user"
						&& event.entries.some((entry) => entry.message.role === "user")
					) {
						draft.transient.tail = { type: "empty" };
					}
					this.removeQueuedInputs(
						draft,
						event.confirmedInputs.map((confirmation) => confirmation.clientId),
					);
					if (event.entries.length > 0) this.advanceTailAfterCommit(draft);
					break;
				}
				case "transcript_rebased": {
					if (!draft.openedSession) throw new Error("Pi 会话尚未加载完成。");
					const transcript = draft.openedSession.transcript;
					transcript.entries.splice(
						event.replaceFrom,
						transcript.entries.length - event.replaceFrom,
						...event.entries,
					);
					this.syncTranscriptSummary(
						draft,
						event.firstMessage,
						event.messageCount,
						event.modifiedAt,
					);
					this.removeQueuedInputs(
						draft,
						event.confirmedInputs.map((confirmation) => confirmation.clientId),
					);
					this.advanceTailAfterCommit(draft);
					break;
				}
				case "queued_inputs_cleared":
					this.removeQueuedInputs(draft, event.clientIds);
					break;
				case "agent_settled":
					this.setStreaming(draft, false);
					this.settleLiveOutput(draft);
					break;
			}
		});
	}

	public acceptPermission(request: PiToolPermissionRequest): void {
		this.snapshot.edit((draft) => {
			const output = this.ensureLiveOutput(draft);
			if (output.permissionRequests.some((candidate) => candidate.id === request.id)) return;
			output.permissionRequests.push(request);
			if (request.toolCallId) {
				this.setTool(
					draft,
					request.toolCallId,
					request.toolName,
					"awaiting_permission",
					null,
				);
			}
		});
	}

	public resolvePermission(
		request: PiToolPermissionRequest,
		allowed: boolean,
	): void {
		this.snapshot.edit((draft) => {
			const output = this.getExistingLiveOutput(draft);
			if (!output || !output.permissionRequests.some((candidate) => candidate.id === request.id)) return;
			draft.error = null;
			output.permissionRequests = output.permissionRequests.filter(
				(candidate) => candidate.id !== request.id,
			);
			if (!allowed && request.toolCallId) {
				this.setTool(
					draft,
					request.toolCallId,
					request.toolName,
					"completed",
					true,
					"用户拒绝执行此工具调用。",
				);
			}
		});
	}


	public enqueue(input: PendingSessionInput): void {
		this.pendingInputs.push(input);
		if (this.pendingInputs.length > MAX_PENDING_INPUTS) this.pendingInputs.shift();
	}

	public takePendingInputs(): PendingSessionInput[] {
		return this.pendingInputs.splice(0);
	}

	public dispose(): void {
		this.pendingInputs.length = 0;
		this.deferredLiveOutput = null;
	}

	private setTool(
		draft: Draft<ChatSessionSnapshot>,
		id: string,
		name: string,
		executionStatus: ChatToolExecutionStatus,
		isError: boolean | null,
		output?: string,
	): void {
		const liveOutput = this.ensureLiveOutput(draft);
		const tool = liveOutput.tools.find((candidate) => candidate.id === id);
		if (tool) {
			tool.name = name;
			tool.isError = isError ?? tool.isError;
			tool.executionStatus = executionStatus;
			if (output !== undefined) tool.output = output;
			return;
		}
		liveOutput.tools.push({
			id,
			name,
			input: {},
			output: output ?? null,
			isError,
			executionStatus,
		});
	}

	private syncTranscriptSummary(
		draft: Draft<ChatSessionSnapshot>,
		firstMessage: string,
		messageCount: number,
		modifiedAt: string,
	): void {
		if (!draft.openedSession) return;
		const { transcript } = draft.openedSession;
		transcript.session.firstMessage = firstMessage;
		transcript.session.messageCount = messageCount;
		transcript.session.modifiedAt = modifiedAt;
	}

	private ensureLiveOutput(draft: Draft<ChatSessionSnapshot>): Draft<ChatLiveAgentTail> {
		if (draft.transient.tail.type === "live-agent") return draft.transient.tail.output;
		if (draft.transient.tail.type === "optimistic-user") {
			this.deferredLiveOutput ??= createLiveAgentTail();
			return this.deferredLiveOutput as Draft<ChatLiveAgentTail>;
		}
		const output = castDraft(createLiveAgentTail());
		draft.transient.tail = { type: "live-agent", output };
		return output;
	}

	private getExistingLiveOutput(
		draft: Draft<ChatSessionSnapshot>,
	): Draft<ChatLiveAgentTail> | null {
		if (draft.transient.tail.type === "live-agent") return draft.transient.tail.output;
		return this.deferredLiveOutput as Draft<ChatLiveAgentTail> | null;
	}

	private settleLiveOutput(draft: Draft<ChatSessionSnapshot>): void {
		const output = this.getExistingLiveOutput(draft);
		if (!output) return;
		output.phase = "settled-awaiting-commit";
		output.permissionRequests = [];
	}

	private removeQueuedInputs(draft: Draft<ChatSessionSnapshot>, clientIds: readonly string[]): void {
		if (clientIds.length === 0) return;
		const removed = new Set(clientIds);
		draft.transient.queuedInputs.steering = draft.transient.queuedInputs.steering.filter(
			(input) => !removed.has(input.message.clientId),
		);
		draft.transient.queuedInputs.followUps = draft.transient.queuedInputs.followUps.filter(
			(input) => !removed.has(input.message.clientId),
		);
	}

	private advanceTailAfterCommit(draft: Draft<ChatSessionSnapshot>): void {
		if (draft.openedSession?.runtime.isStreaming) {
			const output = castDraft(this.deferredLiveOutput ?? createLiveAgentTail());
			draft.transient.tail = { type: "live-agent", output };
		} else {
			draft.transient.tail = { type: "empty" };
		}
		this.deferredLiveOutput = null;
	}

	private setStreaming(draft: Draft<ChatSessionSnapshot>, isStreaming: boolean): void {
		if (!draft.openedSession) throw new Error("Pi 会话尚未加载完成。");
		draft.openedSession.runtime.isStreaming = isStreaming;
	}
}

function findQueuedInput(
	draft: Draft<ChatSessionSnapshot>,
	clientId: string,
): Draft<ChatQueuedUserInput> | undefined {
	return draft.transient.queuedInputs.steering.find(
		(input) => input.message.clientId === clientId,
	) ?? draft.transient.queuedInputs.followUps.find(
		(input) => input.message.clientId === clientId,
	);
}

function createLiveAgentTail(): ChatLiveAgentTail {
	return {
		phase: "streaming",
		text: "",
		thinking: "",
		tools: [],
		permissionRequests: [],
	};
}

