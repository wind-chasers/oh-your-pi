import { memo, useMemo, useRef, useEffect, type ReactNode } from "react";

import { getSessionViewItemKey, type SessionViewItem } from "@view/chat-store/session-view";
import type { ChatTranscriptTail } from "@view/chat-store/types";
import { AssistantMessage } from "./messages/AssistantMessage";
import { SystemMessage } from "./messages/SystemMessage";
import { ToolMessage } from "./messages/ToolMessage";
import { UserMessage, PendingUserMessage, EditingUserMessage  } from "./messages/UserMessage";
import { ToolCallsSection } from "./tools/ToolCallsSection";
import { type UserViewItem } from "@view/chat-store/session-view";
import type { ChatSession } from "@view/chat-store";


export function ChatTranscript({ items, isStreaming, showThinking, tail, editing, session }: {
	items: readonly SessionViewItem[];
	isStreaming: boolean;
	showThinking: boolean;
	session: ChatSession;
	tail: ChatTranscriptTail;
	editing?: UserViewItem | null;
}) {
	const autoScrollRef = useAutoScrollToBottom([items.length, tail]);

	return (
		<div className="relative min-h-0 flex-1">
			<div aria-live="polite" className="chat-scroll-container h-full overflow-y-auto [overflow-anchor:none] px-5 py-5 sm:px-6 sm:py-6">
				<div className="mx-auto flex max-w-3xl flex-col gap-4">
					<PersistItems session={session} items={items} editing={editing} />
					<TransientTail isStreaming={isStreaming} showThinking={showThinking} tail={tail} />
					<div ref={autoScrollRef} />
				</div>
			</div>
			{!editing && (
				<div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-background" />
			)}
		</div>
	);
}

function useAutoScrollToBottom(deps: any[]) {
	const ref = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		ref.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, deps);
	return ref;
}


function TransientTail({ isStreaming, showThinking, tail }: {
	isStreaming: boolean;
	showThinking: boolean;
	tail: ChatTranscriptTail;
}) {
	if (tail.type === "empty") return null;
	if (tail.type === "optimistic-user") {
		const { text, images } = tail.message;
		return <PendingUserMessage images={images} text={text} />;
	}

	const { text, thinking, tools} = tail.output;
	const liveThinking = showThinking ? thinking : undefined;
	return (
		<>
			<ToolCallsSection isLive={isStreaming} toolCalls={tools} />
			<AssistantMessage isStreaming={isStreaming} text={text} thinking={liveThinking} />
		</>
	);
}

const PersistItem = memo(function PersistItem({ item, session, editing }: {
	item: SessionViewItem;
	session: ChatSession;
	editing?: boolean;
}) {
	switch (item.type) {
		case "user":
			return editing
				? <EditingUserMessage data={item} session={session} />
				: <UserMessage data={item} session={session} />;
		case "assistant":
			return <AssistantMessage text={item.text} thinking={item.thinking} timestamp={item.message.timestamp} usage={item.message.usage} />;
		case "system":
			return <SystemMessage text={item.text} />;
		case "bash":
			return <ToolMessage label="Bash" text={item.message.output} />;
		case "custom":
			return <ToolMessage label="扩展" text={item.text} />;
		case "tool-section":
			return <ToolCallsSection toolCalls={item.toolCalls} />;
		default:
			return null;
	}
});

function PersistItems(props: {
	items: readonly SessionViewItem[];
	session: ChatSession;
	editing?: UserViewItem | null;
}) {
	const { items, editing, session } = props;
	return useMemo(() => {
		const nodes: ReactNode[] = [];
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const key = getSessionViewItemKey(item);
			nodes.push(
				<PersistItem
					key={key}
					item={item}
					session={session}
					editing={item.type === "user" && editing?.entryId === item.entryId}
				/>,
			);
		}
		return nodes;
	}, [items, editing]);
}
