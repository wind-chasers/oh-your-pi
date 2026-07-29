import type {
	AgentSessionEvent,
	SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { contentText, type ImageContent, type UserMessage } from "@earendil-works/pi-ai";
import type { PiConfirmedQueuedInput } from "@shared/pi-contract";

export type QueuedInputKind = "steering" | "followUp";

type QueueShadowItem = {
	text: string;
	clientId: string | null;
	images: readonly ImageContent[] | undefined;
};

type PendingQueuedInput = {
	clientId: string;
	images: readonly ImageContent[] | undefined;
};

type TrackedQueue = {
	shadow: QueueShadowItem[];
	pendingInputs: PendingQueuedInput[];
};

type PendingInputConfirmation = {
	clientId: string;
	message: UserMessage;
};

export class QueuedInputTracker {
	private readonly queues: Record<QueuedInputKind, TrackedQueue> = {
		steering: createTrackedQueue(),
		followUp: createTrackedQueue(),
	};
	private readonly awaitingUserMessageClientIds: string[] = [];
	private deliveredUserMessages = new WeakMap<UserMessage, string>();
	private readonly pendingConfirmations: PendingInputConfirmation[] = [];
	private clearingClientIds: string[] | null = null;

	public async enqueue(
		queue: QueuedInputKind,
		clientId: string,
		operation: () => Promise<void>,
		images?: readonly ImageContent[],
	): Promise<void> {
		const tracked = this.queues[queue];
		tracked.pendingInputs.push({ clientId, images });
		try {
			await operation();
		} catch (error) {
			removePendingInput(tracked.pendingInputs, clientId);
			const shadowIndex = tracked.shadow.findIndex((item) => item.clientId === clientId);
			if (shadowIndex >= 0) tracked.shadow.splice(shadowIndex, 1);
			throw error;
		}
	}

	public acceptAgentEvent(event: AgentSessionEvent): string[] {
		const clearedClientIds: string[] = [];
		if (event.type === "queue_update") {
			clearedClientIds.push(...this.updateQueue("steering", event.steering));
			clearedClientIds.push(...this.updateQueue("followUp", event.followUp));
		}
		if (event.type === "message_start" && event.message.role === "user") {
			const clientId = this.awaitingUserMessageClientIds.shift()
				?? this.claimUnreportedImageInput(event.message);
			if (clientId) this.deliveredUserMessages.set(event.message, clientId);
		}
		if (event.type === "message_end" && event.message.role === "user") {
			const clientId = this.deliveredUserMessages.get(event.message);
			if (clientId) {
				this.deliveredUserMessages.delete(event.message);
				this.pendingConfirmations.push({ clientId, message: event.message });
			}
		}
		return clearedClientIds;
	}

	public confirmPersistedEntries(entries: readonly SessionEntry[]): PiConfirmedQueuedInput[] {
		const confirmed: PiConfirmedQueuedInput[] = [];
		for (const entry of entries) {
			if (entry.type !== "message" || entry.message.role !== "user") continue;
			const confirmationIndex = this.pendingConfirmations.findIndex(
				(candidate) => candidate.message === entry.message,
			);
			if (confirmationIndex < 0) continue;
			const [confirmation] = this.pendingConfirmations.splice(confirmationIndex, 1);
			confirmed.push({ clientId: confirmation.clientId, entryId: entry.id });
		}
		return confirmed;
	}

	public clear(operation: () => void): string[] {
		this.clearingClientIds = [];
		try {
			operation();
			return this.clearingClientIds;
		} finally {
			this.clearingClientIds = null;
		}
	}

	public reset(steering: readonly string[], followUps: readonly string[]): void {
		this.queues.steering = createTrackedQueue(steering);
		this.queues.followUp = createTrackedQueue(followUps);
		this.awaitingUserMessageClientIds.length = 0;
		this.deliveredUserMessages = new WeakMap();
		this.pendingConfirmations.length = 0;
		this.clearingClientIds = null;
	}

	/** Pi 不会为纯图片 user message 删除字符串 queue slot；认领 ID 后保留空 slot 以继续对齐后续 queue_update。 */
	private claimUnreportedImageInput(message: UserMessage): string | undefined {
		if (contentText(message.content, "") !== "") return undefined;
		const messageImages = typeof message.content === "string"
			? []
			: message.content.filter((part): part is ImageContent => part.type === "image");
		for (const queue of ["steering", "followUp"] as const) {
			const item = this.queues[queue].shadow.find(
				(candidate) => candidate.clientId && haveSameImageReferences(candidate.images, messageImages),
			);
			if (!item?.clientId) continue;
			const clientId = item.clientId;
			item.clientId = null;
			item.images = undefined;
			return clientId;
		}
		return undefined;
	}

	private updateQueue(queue: QueuedInputKind, nextTexts: readonly string[]): string[] {
		const tracked = this.queues[queue];
		if (
			nextTexts.length >= tracked.shadow.length
			&& tracked.shadow.every((item, index) => item.text === nextTexts[index])
		) {
			for (let index = tracked.shadow.length; index < nextTexts.length; index += 1) {
				const pending = tracked.pendingInputs.shift();
				tracked.shadow.push({
					text: nextTexts[index],
					clientId: pending?.clientId ?? null,
					images: pending?.images,
				});
			}
			return [];
		}

		const reconciliation = reconcileRemovedQueueItems(tracked.shadow, nextTexts);
		if (!reconciliation) {
			const clearedClientIds = tracked.shadow.flatMap((item) => item.clientId ? [item.clientId] : []);
			tracked.shadow = nextTexts.map((text) => ({ text, clientId: null, images: undefined }));
			tracked.pendingInputs = [];
			if (this.clearingClientIds) {
				this.clearingClientIds.push(...clearedClientIds);
				return [];
			}
			return clearedClientIds;
		}

		tracked.shadow = reconciliation.remaining;
		const deliveredClientIds = reconciliation.removed.flatMap(
			(item) => item.clientId ? [item.clientId] : [],
		);
		if (this.clearingClientIds) this.clearingClientIds.push(...deliveredClientIds);
		else this.awaitingUserMessageClientIds.push(...deliveredClientIds);
		return [];
	}
}

function createTrackedQueue(texts: readonly string[] = []): TrackedQueue {
	return {
		shadow: texts.map((text) => ({ text, clientId: null, images: undefined })),
		pendingInputs: [],
	};
}

function reconcileRemovedQueueItems(
	previous: readonly QueueShadowItem[],
	nextTexts: readonly string[],
): { remaining: QueueShadowItem[]; removed: QueueShadowItem[] } | null {
	const remaining = new Array<QueueShadowItem>(nextTexts.length);
	const retainedIndexes = new Set<number>();
	let nextIndex = nextTexts.length - 1;
	for (let previousIndex = previous.length - 1; previousIndex >= 0 && nextIndex >= 0; previousIndex -= 1) {
		if (previous[previousIndex].text !== nextTexts[nextIndex]) continue;
		remaining[nextIndex] = previous[previousIndex];
		retainedIndexes.add(previousIndex);
		nextIndex -= 1;
	}
	if (nextIndex >= 0) return null;
	return {
		remaining,
		removed: previous.filter((_, index) => !retainedIndexes.has(index)),
	};
}

function haveSameImageReferences(
	expected: readonly ImageContent[] | undefined,
	actual: readonly ImageContent[],
): boolean {
	return expected !== undefined
		&& expected.length === actual.length
		&& expected.every((image, index) => image === actual[index]);
}

function removePendingInput(items: PendingQueuedInput[], clientId: string): void {
	const index = items.findIndex((item) => item.clientId === clientId);
	if (index >= 0) items.splice(index, 1);
}
