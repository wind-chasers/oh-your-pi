import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listWorkspaceFiles, readWorkspaceFile, resolveWorkspacePath } from "./files";

let workspacePath = "";
let externalPath = "";

beforeEach(async () => {
	workspacePath = await mkdtemp(join(tmpdir(), "oh-your-pi-files-"));
	externalPath = await mkdtemp(join(tmpdir(), "oh-your-pi-external-"));
	await writeFile(join(externalPath, "secret.txt"), "do not expose\n");
	await symlink(join(externalPath, "secret.txt"), join(workspacePath, "linked-secret.txt"));
	await mkdir(join(workspacePath, "src"));
	await mkdir(join(workspacePath, ".git"));
	await writeFile(join(workspacePath, "README.md"), "# Workspace\n");
	await writeFile(join(workspacePath, "src", "main.ts"), "export const answer = 42;\n");
});

afterEach(async () => {
	await rm(workspacePath, { force: true, recursive: true });
	await rm(externalPath, { force: true, recursive: true });
});

describe("workspace files", () => {
	test("lists directories before files and omits internal directories", async () => {
		const files = await listWorkspaceFiles({ workspacePath });
		expect(files).toEqual([
			{ name: "src", path: "src", type: "directory" },
			{ name: "linked-secret.txt", path: "linked-secret.txt", type: "file" },
			{ name: "README.md", path: "README.md", type: "file" },
		]);
	});

	test("reads a selected workspace file", async () => {
		const file = await readWorkspaceFile({ relativePath: "src/main.ts", workspacePath });
		expect(file).toMatchObject({
			content: "export const answer = 42;\n",
			isBinary: false,
			isTruncated: false,
			path: "src/main.ts",
		});
	});

	test("truncates previews without returning content past the limit", async () => {
		await writeFile(join(workspacePath, "large.txt"), "a".repeat(512 * 1024 + 128));
		const file = await readWorkspaceFile({ relativePath: "large.txt", workspacePath });
		expect(file).toMatchObject({ isBinary: false, isTruncated: true, path: "large.txt" });
		expect(file.content).toHaveLength(512 * 1024);
	});

	test("rejects paths outside the workspace", () => {
		expect(() => resolveWorkspacePath(workspacePath, "../secret.txt")).toThrow("当前工作区内");
	});

	test("rejects a symbolic link outside the workspace", async () => {
		await expect(readWorkspaceFile({ relativePath: "linked-secret.txt", workspacePath })).rejects.toThrow("当前工作区内");
	});
});
