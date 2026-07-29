import type { ReactElement } from "react";
import type { ChatQueuedInputs, ChatQueuedUserInput } from "@view/chat-store/types";

export function QueuedInputs({ items }: { items: ChatQueuedInputs }): ReactElement | null {
	if (items.steering.length === 0 && items.followUps.length === 0) return null;
	return (
		<section aria-label="待处理消息" aria-live="polite" className="mx-auto mb-2 max-w-3xl">
			<p className="mb-1 px-1 text-xs font-medium text-muted-foreground">待处理消息</p>
			<ol className="flex flex-col gap-1.5">
				{items.steering.map((item) => (
					<QueuedInputItem item={item} key={item.message.clientId} label="调整当前任务" />
				))}
				{items.followUps.map((item) => (
					<QueuedInputItem item={item} key={item.message.clientId} label="后续任务" />
				))}
			</ol>
		</section>
	);
}

function QueuedInputItem({ item, label }: {
	item: ChatQueuedUserInput;
	label: string;
}): ReactElement {
	const fallback = item.message.images.length > 0
		? `${item.message.images.length} 张图片`
		: "空消息";
	return (
		<li className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
			<span className="shrink-0 font-medium text-foreground">{label}</span>
			<span className="min-w-0 flex-1 truncate text-muted-foreground" title={item.message.text || fallback}>
				{item.message.text || fallback}
			</span>
			<span className="shrink-0 text-muted-foreground/70">
				{item.state === "submitting" ? "发送中" : "已排队"}
			</span>
		</li>
	);
}
