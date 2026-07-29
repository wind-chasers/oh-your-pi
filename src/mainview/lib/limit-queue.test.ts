import { describe, expect, test } from "bun:test";
import { LimitQueue } from "./limit-queue";

interface Deferred {
	promise: Promise<void>;
	resolve(): void;
}

function createDeferred(): Deferred {
	let resolve!: () => void;
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

function nextMicrotask(): Promise<void> {
	return Promise.resolve();
}

describe("LimitQueue", () => {
	test("runs tasks in FIFO order up to the configured limit", async () => {
		const limiter = new LimitQueue(2);
		const started: number[] = [];
		const gates = Array.from({ length: 4 }, createDeferred);
		const tasks = gates.map((gate, id) =>
			limiter.run(() => {
				started.push(id);
				return gate.promise;
			}),
		);

		await nextMicrotask();
		expect(started).toEqual([0, 1]);

		gates[0].resolve();
		await tasks[0];
		expect(started).toEqual([0, 1, 2]);

		gates[1].resolve();
		await tasks[1];
		expect(started).toEqual([0, 1, 2, 3]);

		gates[2].resolve();
		gates[3].resolve();
		await Promise.all(tasks);
	});

	test("supports microtask and macrotask scheduling", async () => {
		let microStarted = false;
		let macroStarted = false;
		const microTask = new LimitQueue(1, "micro").run(() => {
			microStarted = true;
		});
		const macroTask = new LimitQueue(1, "macro").run(() => {
			macroStarted = true;
		});

		expect(microStarted).toBe(false);
		expect(macroStarted).toBe(false);
		await nextMicrotask();
		expect(microStarted).toBe(true);
		expect(macroStarted).toBe(false);

		await Promise.all([microTask, macroTask]);
		expect(macroStarted).toBe(true);
	});

	test("returns a native Promise with a cancel method", async () => {
		const task = new LimitQueue(1).run(() => 42);

		expect(task).toBeInstanceOf(Promise);
		expect(typeof task.cancel).toBe("function");
		expect(await task).toBe(42);
		expect(task.cancel()).toBe(false);
	});

	test("cancels a queued task without invoking it", async () => {
		const limiter = new LimitQueue(1);
		const firstGate = createDeferred();
		const first = limiter.run(() => firstGate.promise);
		await nextMicrotask();

		let cancelledTaskStarted = false;
		const cancelled = limiter.run(() => {
			cancelledTaskStarted = true;
		});
		const cancellation = cancelled.catch((error: unknown) => error);
		const next = limiter.run(() => 42);

		expect(cancelled.cancel()).toBe(true);
		expect(cancelled.cancel()).toBe(false);
		firstGate.resolve();

		await first;
		expect(await next).toBe(42);
		expect(cancelledTaskStarted).toBe(false);
		const error = await cancellation;
		expect(error).toBeInstanceOf(DOMException);
		expect((error as DOMException).name).toBe("AbortError");
	});

	test("cancels a scheduled task before its runner starts", async () => {
		const limiter = new LimitQueue(1);
		let cancelledTaskStarted = false;
		const cancelled = limiter.run(() => {
			cancelledTaskStarted = true;
		});
		const cancellation = cancelled.catch((error: unknown) => error);

		expect(cancelled.cancel()).toBe(true);
		expect(await limiter.run(() => 42)).toBe(42);
		expect(cancelledTaskStarted).toBe(false);
		expect((await cancellation as DOMException).name).toBe("AbortError");
	});

	test("aborts a running task without releasing its slot early", async () => {
		const limiter = new LimitQueue(1);
		const runningGate = createDeferred();
		let taskSignal: AbortSignal | undefined;
		const running = limiter.run((signal) => {
			taskSignal = signal;
			return runningGate.promise;
		});
		const cancellation = running.catch((error: unknown) => error);
		let nextTaskStarted = false;
		const next = limiter.run(() => {
			nextTaskStarted = true;
			return 42;
		});

		await nextMicrotask();
		expect(taskSignal?.aborted).toBe(false);
		expect(running.cancel()).toBe(true);
		expect(taskSignal?.aborted).toBe(true);
		expect((await cancellation as DOMException).name).toBe("AbortError");
		await nextMicrotask();
		expect(nextTaskStarted).toBe(false);

		runningGate.resolve();
		expect(await next).toBe(42);
		expect(nextTaskStarted).toBe(true);
		expect(running.cancel()).toBe(false);
	});

	test("releases its slot after fulfilled and rejected tasks", async () => {
		const limiter = new LimitQueue(1);
		const first = limiter.run(async () => {
			throw new Error("failed");
		});
		const second = limiter.run(() => 42);

		const [firstResult, secondResult] = await Promise.allSettled([first, second]);

		expect(firstResult.status).toBe("rejected");
		if (firstResult.status === "rejected") expect(firstResult.reason).toEqual(new Error("failed"));
		expect(secondResult).toEqual({ status: "fulfilled", value: 42 });
	});

	test("preserves an undefined rejection and releases its slot", async () => {
		const limiter = new LimitQueue(1);
		const first = limiter.run(() => Promise.reject(undefined));
		const second = limiter.run(() => 42);
		const [firstResult, secondResult] = await Promise.allSettled([first, second]);

		expect(firstResult).toEqual({ status: "rejected", reason: undefined });
		expect(secondResult).toEqual({ status: "fulfilled", value: 42 });
	});

	test("rejects invalid limits", () => {
		expect(() => new LimitQueue(0)).toThrow(RangeError);
		expect(() => new LimitQueue(1.5)).toThrow(RangeError);
		expect(() => new LimitQueue(1, "invalid" as never)).toThrow(RangeError);
	});
});
