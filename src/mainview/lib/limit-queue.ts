export type LimitQueueRunner<T> = (signal: AbortSignal) => T | PromiseLike<T>;

export type LimitQueueTask<T> = Promise<T> & {
	/** Cancel this task. Running work must observe its AbortSignal to stop early. */
	cancel(): boolean;
};

export type LimitQueueSchedule = "micro" | "macro";

type ScheduleTask = (task: () => void) => void;

type QueuedTaskState = "queued" | "scheduled" | "running" | "settled";

const PENDING_COMPACTION_THRESHOLD = 1024;

interface PendingTask {
	start(): boolean;
}

interface PendingTaskResult<T> extends PendingTask {
	result: LimitQueueTask<T>;
}

function createQueuedTask<T>(
	runner: LimitQueueRunner<T>,
	releaseSlot: () => void,
	scheduleTask: ScheduleTask,
): PendingTaskResult<T> {
	const abortController = new AbortController();
	const { promise, reject, resolve } = Promise.withResolvers<T>();
	const result = promise as LimitQueueTask<T>;
	let state: QueuedTaskState = "queued";

	function completeExecution(): boolean {
		const shouldSettleResult = state === "running";
		state = "settled";
		releaseSlot();
		return shouldSettleResult;
	}

	async function execute(): Promise<void> {
		if (state !== "scheduled") return;
		state = "running";

		try {
			const value = await runner(abortController.signal);
			if (completeExecution()) resolve(value);
		} catch (error) {
			if (completeExecution()) reject(error);
		}
	}

	function start(): boolean {
		if (state !== "queued") return false;

		state = "scheduled";
		scheduleTask(execute);
		return true;
	}

	function cancel(): boolean {
		if (state === "settled") return false;

		const releaseImmediately = state === "scheduled";
		state = "settled";
		const error = createAbortError();
		abortController.abort(error);
		reject(error);

		if (releaseImmediately) releaseSlot();
		return true;
	}

	Object.defineProperty(result, "cancel", { value: cancel });
	return { result, start };
}

function createAbortError(): DOMException {
	return new DOMException("The operation was aborted", "AbortError");
}

function resolveScheduleTask(schedule: LimitQueueSchedule): ScheduleTask {
	if (schedule === "micro") return queueMicrotask;
	if (schedule === "macro") return queueMacroTask;
	throw new RangeError('LimitQueue schedule must be "micro" or "macro"');
}

function queueMacroTask(task: () => void): void {
	setTimeout(task, 0);
}

export class LimitQueue {
	private activeCount = 0;
	private pendingHead = 0;
	private pending: PendingTask[] = [];
	private readonly scheduleTask: ScheduleTask;

	public constructor(private readonly limit: number, schedule: LimitQueueSchedule = "micro") {
		if (!Number.isInteger(limit) || limit < 1) {
			throw new RangeError("LimitQueue limit must be a positive integer");
		}
		this.scheduleTask = resolveScheduleTask(schedule);
	}

	/** Queue a task and return a native Promise with cooperative cancellation. */
	public run<T>(runner: LimitQueueRunner<T>): LimitQueueTask<T> {
		const task = createQueuedTask(runner, this.release, this.scheduleTask);
		this.pending.push(task);
		this.drain();
		return task.result;
	}

	private readonly release = (): void => {
		this.activeCount--;
		this.drain();
	};

	private drain(): void {
		while (this.activeCount < this.limit && this.pendingHead < this.pending.length) {
			const task = this.pending[this.pendingHead++];
			if (task.start()) this.activeCount++;
		}

		if (this.pendingHead === this.pending.length) {
			this.pending = [];
			this.pendingHead = 0;
		} else if (
			this.pendingHead >= PENDING_COMPACTION_THRESHOLD &&
			this.pendingHead * 2 >= this.pending.length
		) {
			this.pending = this.pending.slice(this.pendingHead);
			this.pendingHead = 0;
		}
	}
}
