import { Sparkles, Waypoints } from "lucide-react";
import { type ReactElement } from "react";
import type { PiConversationEntry } from "@shared/pi-contract";
import { MarkdownContent } from "@view/components/markdown-content";
import { AssistantMessage } from "./messages/AssistantMessage";
import { SystemMessage } from "./messages/SystemMessage";
import { ToolMessage } from "./messages/ToolMessage";
import { UserMessage } from "./messages/UserMessage";

export type ToolStatus = {
	isError: boolean | undefined;
	name: string;
	status: "awaiting_permission" | "running" | "complete";
};

type ChatTranscriptProps = {
	entries: PiConversationEntry[];
	isStreaming: boolean;
	pendingUserMessage?: string;
	showThinking: boolean;
	streamedText: string;
	thinkingText: string;
	tools: Array<[string, ToolStatus]>;
	transcriptEndRef: React.RefObject<HTMLDivElement | null>;
};

export function ChatTranscript({
	entries,
	isStreaming,
	pendingUserMessage,
	showThinking,
	streamedText,
	thinkingText,
	tools,
	transcriptEndRef,
}: ChatTranscriptProps): ReactElement {
	return (
		<div className="relative min-h-0 flex-1">
			<div aria-live="polite" className="h-full overflow-y-auto px-5 py-6">
				<div className="mx-auto flex max-w-3xl flex-col gap-5">
					{entries.map((entry) => (
						<ConversationEntry entry={entry} key={entry.id} />
					))}
					{pendingUserMessage ? (
						<PendingUserMessage text={pendingUserMessage} />
					) : null}
					{isStreaming && !streamedText ? <StreamingPlaceholder /> : null}
					{isStreaming && streamedText ? (
						<StreamingAssistantMessage text={streamedText} />
					) : null}
					{showThinking && isStreaming && thinkingText ? (
						<StreamingThinking text={thinkingText} />
					) : null}
					{isStreaming && tools.length > 0 ? (
						<section
							aria-label="工具执行时间线"
							className="rounded-lg border bg-muted/30 p-3"
						>
							<p className="text-xs font-medium text-muted-foreground">
								工具执行
							</p>
							<div className="mt-2 space-y-2">
								{tools.map(([toolCallId, tool]) => (
									<ToolCallStatus key={toolCallId} tool={tool} />
								))}
							</div>
						</section>
					) : null}
					<div ref={transcriptEndRef} />
				</div>
			</div>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-background"
			/>
		</div>
	);
}

function ConversationEntry({ entry }: { entry: PiConversationEntry }): ReactElement {
	switch (entry.role) {
		case "user": return <UserMessage text={entry.text} />;
		case "assistant": return <AssistantMessage text={entry.text} thinking={entry.thinking} />;
		case "system": return <SystemMessage text={entry.text} />;
		case "tool": return <ToolMessage label="工具结果" text={entry.text} />;
		case "bash": return <ToolMessage label="Bash" text={entry.text} />;
		case "custom": return <ToolMessage label="扩展" text={entry.text} />;
	}
}
function PendingUserMessage({ text }: { text: string }): ReactElement {
	return (
		<article className="ml-auto w-fit max-w-[85%]">
			<div className="rounded-2xl rounded-br-sm bg-primary/85 px-4 py-3 text-sm text-primary-foreground">
				<p className="mb-2 text-xs text-primary-foreground/70">已发送</p>
				<MarkdownContent>{text}</MarkdownContent>
			</div>
		</article>
	);
}
function StreamingPlaceholder(): ReactElement {
	return (
		<article className="max-w-[90%]">
			<div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm text-muted-foreground">
				<Sparkles aria-hidden className="size-4 animate-pulse" />
				正在思考…
			</div>
		</article>
	);
}
function StreamingAssistantMessage({ text }: { text: string }): ReactElement {
	return (
		<article className="max-w-[90%]">
			<div className="rounded-2xl rounded-bl-sm border border-primary/30 bg-card px-4 py-3 text-sm">
				<p className="mb-2 text-xs text-muted-foreground">回复中</p>
				<MarkdownContent>{text}</MarkdownContent>
			</div>
		</article>
	);
}
function StreamingThinking({ text }: { text: string }): ReactElement {
	return (
		<article className="max-w-[90%]">
			<div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
				<p className="mb-2 text-xs">思考中</p>
				<MarkdownContent>{text}</MarkdownContent>
			</div>
		</article>
	);
}
function ToolCallStatus({ tool }: { tool: ToolStatus }): ReactElement {
	return (
		<div className="flex items-center gap-2 rounded-md bg-background px-3 py-2 text-xs">
			<Waypoints aria-hidden className="size-3.5 text-muted-foreground" />
			<span>{tool.name}</span>
			<span className="ml-auto text-muted-foreground">
				{formatToolStatus(tool)}
			</span>
		</div>
	);
}
function formatToolStatus(tool: ToolStatus): string {
	if (tool.status === "awaiting_permission") return "等待授权";
	if (tool.status === "running") return "执行中";
	return tool.isError ? "失败" : "已完成";
}
