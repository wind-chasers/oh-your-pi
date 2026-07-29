import { type ReactElement } from "react";
import {
	getSessionViewItemKey,
	type ChatToolCall,
	type SessionViewItem,
} from "@view/chat-store";
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

	const liveThinking = showThinking ? thinkingText : undefined;
	const hasLiveAssistant = Boolean(
		streamedText || liveThinking || (isStreaming && tools.length === 0),
	);

	return (
		<div className="relative min-h-0 flex-1">
			<div aria-live="polite" className="chat-scroll-container h-full overflow-y-auto [overflow-anchor:none] px-5 py-5 sm:px-6 sm:py-6">
				<div className="mx-auto flex max-w-3xl flex-col gap-4">
					{items.map((item, index) => (
						<ConversationRenderItem
							isLive={isStreaming && tools.length === 0 && index === lastToolSectionIndex}
							item={item}
							key={getSessionViewItemKey(item)}
						/>
					))}
					{pendingUserMessage ? <UserMessage images={[]} isPending text={pendingUserMessage} /> : null}
					{hasLiveAssistant ? (
						<AssistantMessage isStreaming={isStreaming} text={streamedText} thinking={liveThinking} />
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
			return <AssistantMessage text={item.text} thinking={item.thinking} timestamp={item.message.timestamp} usage={item.message.usage} />;
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

