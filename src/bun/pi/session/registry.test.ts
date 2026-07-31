import { expect, mock, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { PiSessionRegistry } from "./registry";
import type { PiSession } from "./session";

type RegistryState = {
	opening: Map<string, Promise<PiSession>>;
	sessions: Map<string, PiSession>;
};

test("运行中的会话不能被删除", async () => {
	const directory = await mkdtemp(join(tmpdir(), "oh-your-pi-registry-"));
	const sessionPath = join(directory, "session.jsonl");
	await writeFile(sessionPath, "session\n");
	const dispose = mock(async () => {});
	const registry = createRegistry();
	getRegistryState(registry).sessions.set(
		resolve(sessionPath),
		{ dispose, isIdle: false } as unknown as PiSession,
	);

	try {
		await expect(registry.delete(sessionPath)).rejects.toThrow("请完成或中止后再删除会话");
		expect(await readFile(sessionPath, "utf8")).toBe("session\n");
		expect(dispose).not.toHaveBeenCalled();
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
});

test("删除会等待正在打开的会话并阻止新的打开", async () => {
	const directory = await mkdtemp(join(tmpdir(), "oh-your-pi-registry-"));
	const sessionPath = join(directory, "session.jsonl");
	await writeFile(sessionPath, "session\n");
	const dispose = mock(async () => {});
	const session = { dispose, isIdle: true } as unknown as PiSession;
	const registry = createRegistry();
	const state = getRegistryState(registry);
	const controlled = Promise.withResolvers<PiSession>();
	const opening = controlled.promise.then((openedSession) => {
		state.sessions.set(resolve(sessionPath), openedSession);
		return openedSession;
	});
	state.opening.set(resolve(sessionPath), opening);

	try {
		const deleting = registry.delete(sessionPath);
		await expect(registry.open({
			hooks: {},
			sessionManager: {
				getSessionFile: () => sessionPath,
			} as SessionManager,
			workspacePath: directory,
		})).rejects.toThrow("会话正在删除");
		controlled.resolve(session);
		await deleting;
		expect(dispose).toHaveBeenCalledTimes(1);
		await expect(stat(sessionPath)).rejects.toThrow();
	} finally {
		await rm(directory, { force: true, recursive: true });
	}
});

function createRegistry(): PiSessionRegistry {
	return new PiSessionRegistry("", {} as ModelRuntime);
}

function getRegistryState(registry: PiSessionRegistry): RegistryState {
	return registry as unknown as RegistryState;
}
