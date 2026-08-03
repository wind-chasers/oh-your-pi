import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 固定 ensureFd 为不可用：全项目模糊分支稳定走降级，不依赖本机是否安装 fd。
mock.module("@main/pi/tools", () => ({
	ensureFd: () => Promise.resolve(null),
}));

const { rankFdResults, searchWorkspaceFiles } = await import("./search");

let workspacePath = "";

beforeEach(async () => {
	workspacePath = await mkdtemp(join(tmpdir(), "oh-your-pi-search-"));
	await mkdir(join(workspacePath, "src", "deep"), { recursive: true });
	await mkdir(join(workspacePath, "assets"));
	await mkdir(join(workspacePath, ".git"));
	await mkdir(join(workspacePath, "node_modules"));
	await writeFile(join(workspacePath, "README.md"), "# Workspace\n");
	await writeFile(join(workspacePath, "src", "main.ts"), "export const answer = 42;\n");
	await writeFile(join(workspacePath, "src", "main.test.ts"), "import { test } from 'bun:test';\n");
	await writeFile(join(workspacePath, "src", "deep", "util.ts"), "export const util = 1;\n");
	await writeFile(join(workspacePath, "assets", "logo.svg"), "<svg/>\n");
	await writeFile(join(workspacePath, "node_modules", "dep.ts"), "// ignored\n");
});

afterEach(async () => {
	await rm(workspacePath, { force: true, recursive: true });
});

describe("rankFdResults", () => {
	test("scores exact name above prefix above substring and boosts directories", () => {
		const lines = [
			"src/foo",
			"src/foo.ts",
			"src/foobar.ts",
			"src/xfoox.ts",
			"src/foobar/",
			"tests/deep/foo-helper.ts",
		];
		const ranked = rankFdResults(lines, "foo");
		expect(ranked.map(({ path }) => path)).toEqual([
			"src/foo",
			"src/foobar",
			"src/foo.ts",
			"src/foobar.ts",
			"tests/deep/foo-helper.ts",
			"src/xfoox.ts",
		]);
	});

	test("marks trailing-slash lines as directories and strips the slash", () => {
		const ranked = rankFdResults(["src/", "src/foo/", "src/foo.ts"], "foo");
		expect(ranked[0]).toEqual({ path: "src/foo", isDirectory: true });
		expect(ranked[1]).toEqual({ path: "src/foo.ts", isDirectory: false });
	});

	test("drops ignored directories and zero-score matches", () => {
		const ranked = rankFdResults([
			".git/",
			"node_modules/index.js",
			"dist/index.js",
			"src/.next/index.js",
			"src/other/",
			"src/a.ts",
		], "index");
		expect(ranked).toEqual([]);
	});

	test("caps results at twenty entries", () => {
		const lines = Array.from({ length: 30 }, (_, index) => `src/file-${index}.ts`);
		expect(rankFdResults(lines, "file")).toHaveLength(20);
	});
});

describe("searchWorkspaceFiles", () => {
	test("empty query lists the workspace root, directories first", async () => {
		const { items, degraded } = await searchWorkspaceFiles({ query: "", workspacePath });
		expect(degraded).toBe(false);
		expect(items).toEqual([
			["assets", 1],
			["src", 1],
			["README.md", 0],
		]);
	});

	test("path-like query lists a single directory prefix-matched", async () => {
		const { items, degraded } = await searchWorkspaceFiles({ query: "src/", workspacePath });
		expect(degraded).toBe(false);
		expect(items).toEqual([
			["src/deep", 1],
			["src/main.test.ts", 0],
			["src/main.ts", 0],
		]);
	});

	test("path-like query with fragment filters by name prefix", async () => {
		const { items } = await searchWorkspaceFiles({ query: "src/ma", workspacePath });
		expect(items.map(([path]) => path)).toEqual(["src/main.test.ts", "src/main.ts"]);
	});

	test("caps directory completion results", async () => {
		await Promise.all(Array.from({ length: 30 }, (_, index) => writeFile(
			join(workspacePath, `file-${index}.ts`),
			"",
		)));
		const { items } = await searchWorkspaceFiles({ query: "file-", workspacePath });
		expect(items).toHaveLength(20);
	});

	test("query without slash degrades to root prefix match when fd is unavailable", async () => {
		const { items, degraded } = await searchWorkspaceFiles({ query: "mai", workspacePath });
		expect(degraded).toBe(true);
		expect(items).toEqual([]);
	});

	test("rejects queries escaping the workspace", async () => {
		const { items } = await searchWorkspaceFiles({ query: "../", workspacePath });
		expect(items).toEqual([]);
	});

	test("does not traverse directories linked outside the workspace", async () => {
		const externalPath = await mkdtemp(join(tmpdir(), "oh-your-pi-external-"));
		try {
			await writeFile(join(externalPath, "secret.txt"), "secret");
			await symlink(externalPath, join(workspacePath, "linked"));
			const { items } = await searchWorkspaceFiles({ query: "linked/", workspacePath });
			expect(items).toEqual([]);
		} finally {
			await rm(externalPath, { force: true, recursive: true });
		}
	});
});
