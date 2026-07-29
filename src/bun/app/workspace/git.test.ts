import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectWorkspaceGit, switchWorkspaceGitBranch } from "./git";

let workspacePath = "";

beforeEach(async () => {
	workspacePath = await mkdtemp(join(tmpdir(), "oh-your-pi-git-"));
	await runGit(["init"]);
	await runGit(["config", "user.email", "test@example.com"]);
	await runGit(["config", "user.name", "Test User"]);
	await runGit(["checkout", "-b", "main"]);
	await writeFile(join(workspacePath, "README.md"), "# Test workspace\n");
	await runGit(["add", "README.md"]);
	await runGit(["commit", "-m", "Initial commit"]);
	await runGit(["branch", "feature"]);
});

afterEach(async () => {
	await rm(workspacePath, { force: true, recursive: true });
});

describe("工作区 Git", () => {
	test("非 Git 目录不显示仓库信息", async () => {
		const directory = await mkdtemp(join(tmpdir(), "oh-your-pi-no-git-"));
		try {
			expect(await inspectWorkspaceGit(directory)).toBeNull();
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	test("读取本地分支并切换当前分支", async () => {
		expect(await inspectWorkspaceGit(workspacePath)).toEqual({
		branches: ["feature", "main"],
		currentBranch: "main",
		});

		expect(
			await switchWorkspaceGitBranch({ branch: "feature", workspacePath }),
		).toEqual({
			branches: ["feature", "main"],
			currentBranch: "feature",
		});
	});

	test("未提交改动会被目标分支覆盖时保留当前分支和工作区", async () => {
		await runGit(["checkout", "feature"]);
		await writeFile(join(workspacePath, "README.md"), "# Feature branch\n");
		await runGit(["add", "README.md"]);
		await runGit(["commit", "-m", "Feature change"]);
		await runGit(["checkout", "main"]);
		await writeFile(join(workspacePath, "README.md"), "# Uncommitted change\n");

		await expect(
			switchWorkspaceGitBranch({ branch: "feature", workspacePath }),
		).rejects.toThrow();
		expect((await inspectWorkspaceGit(workspacePath))?.currentBranch).toBe("main");
		expect(await readFile(join(workspacePath, "README.md"), "utf8")).toBe("# Uncommitted change\n");
	});
});

async function runGit(args: string[]): Promise<void> {
	const process = Bun.spawn(["git", "-C", workspacePath, ...args], {
		stderr: "pipe",
		stdout: "pipe",
	});
	const exitCode = await process.exited;
	if (exitCode === 0) return;
	throw new Error((await new Response(process.stderr).text()).trim());
}
