import { Sparkles } from "lucide-react";
import { type ReactElement } from "react";
import {
	getSessionViewItemKey,
	type ChatToolCall,
	type SessionViewItem,
} from "@view/chat-store";
import { MarkdownContent } from "@view/components/markdown-content";
import { AssistantMessage } from "./messages/AssistantMessage";
import { SystemMessage } from "./messages/SystemMessage";
import { ToolMessage } from "./messages/ToolMessage";
import { UserMessage } from "./messages/UserMessage";
import { ToolCallsSection } from "./tools/ToolCallsSection";

type ChatTranscriptProps = {
	items: readonly SessionViewItem[];
	isStreaming: boolean;
	pendingUserMessage?: string;
	showThinking: boolean;
	streamedText: string;
	thinkingText: string;
	tools: readonly ChatToolCall[];
	transcriptEndRef: React.RefObject<HTMLDivElement | null>;
};

export function ChatTranscript({
	items,
	isStreaming,
	pendingUserMessage,
	showThinking,
	streamedText,
	thinkingText,
	tools,
	transcriptEndRef,
}: ChatTranscriptProps): ReactElement {
	let lastToolSectionIndex = -1;
	for (let index = items.length - 1; index >= 0; index -= 1) {
		if (items[index].type !== "tool-section") continue;
		lastToolSectionIndex = index;
		break;
	}

	return (
		<div className="relative min-h-0 flex-1">
			<div aria-live="polite" className="chat-scroll-container h-full overflow-y-auto [overflow-anchor:none] px-5 py-6">
				<div className="mx-auto flex max-w-3xl flex-col gap-5">
					{items.map((item, index) => (
						<ConversationRenderItem
							isLive={isStreaming && tools.length === 0 && index === lastToolSectionIndex}
							item={item}
							key={getSessionViewItemKey(item)}
						/>
					))}
					{pendingUserMessage ? (
						<PendingUserMessage text={pendingUserMessage} />
					) : null}
					{isStreaming && !streamedText && tools.length === 0 ? <StreamingPlaceholder /> : null}
					{streamedText ? (
						<StreamingAssistantMessage text={streamedText} />
					) : null}
					{showThinking && thinkingText ? (
						<StreamingThinking text={thinkingText} />
					) : null}
					{tools.length > 0 ? <ToolCallsSection isLive={isStreaming} toolCalls={tools} /> : null}
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

function ConversationRenderItem({ isLive, item }: {
	isLive: boolean;
	item: SessionViewItem;
}): ReactElement {
	switch (item.type) {
		case "user":
			return <UserMessage images={item.images} text={item.text} />;
		case "assistant":
			return <AssistantMessage text={item.text} thinking={item.thinking} />;
		case "system":
			return <SystemMessage text={item.text} />;
		case "bash":
			return <ToolMessage label="Bash" text={item.message.output} />;
		case "custom":
			return <ToolMessage label="扩展" text={item.text} />;
		case "tool-section":
			return <ToolCallsSection isLive={isLive} toolCalls={item.toolCalls} />;
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
