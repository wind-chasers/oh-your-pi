import { spawn } from "node:child_process";
import { opendir, realpath } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { PiFileSearchRequest, PiFileSearchResult } from "@shared/pi-contract";
import { ensureFd } from "@main/pi/tools";
import { HIDDEN_DIRECTORIES, resolveWorkspacePath } from "./files";

const FD_MAX_RESULTS = 100;
const FD_SEARCH_TIMEOUT_MS = 5_000;
const FD_TOP_RESULTS = 20;
const FD_EXCLUDE_ARGS = Array.from(HIDDEN_DIRECTORIES, (directory) => ["--exclude", directory]).flat();

const activeSearches = new Map<string, AbortController>();

type SearchItem = { isDirectory: boolean; path: string };

function toPosixPath(path: string): string {
	return path.replace(/\\/g, "/");
}

function isHiddenPath(path: string): boolean {
	return toPosixPath(path).split("/").some((part) => HIDDEN_DIRECTORIES.has(part));
}

function toSearchResult(degraded: boolean, items: SearchItem[]): PiFileSearchResult {
	return { degraded, items: items.map(({ isDirectory, path }) => [path, isDirectory ? 1 : 0]) };
}

function compareSearchItems(left: SearchItem, right: SearchItem): number {
	if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
	return left.path.localeCompare(right.path, undefined, { numeric: true, sensitivity: "base" });
}

function addSearchItem(items: SearchItem[], item: SearchItem): void {
	items.push(item);
	items.sort(compareSearchItems);
	if (items.length > FD_TOP_RESULTS) items.pop();
}

/** 单层目录补全：列出 directory 下前缀匹配 fragment 的条目，目录优先。 */
async function listDirectoryPrefix(
	root: string,
	directory: string,
	fragment: string,
	signal: AbortSignal,
): Promise<SearchItem[]> {
	const absoluteDirectory = await resolveExistingDirectory(root, directory);
	if (!absoluteDirectory || signal.aborted) return [];
	const prefix = fragment.toLowerCase();
	const parentPath = directory === "." ? "" : directory;
	const items: SearchItem[] = [];
	try {
		const entries = await opendir(absoluteDirectory);
		for await (const entry of entries) {
			if (signal.aborted) return [];
			if (HIDDEN_DIRECTORIES.has(entry.name) || !entry.name.toLowerCase().startsWith(prefix)) continue;
			addSearchItem(items, {
				path: toPosixPath(parentPath ? join(parentPath, entry.name) : entry.name),
				isDirectory: entry.isDirectory(),
			});
		}
		return items;
	} catch {
		return [];
	}
}

async function resolveExistingDirectory(root: string, directory: string): Promise<string | null> {
	try {
		const absolute = await realpath(resolveWorkspacePath(root, directory));
		return absolute === root || !relative(root, absolute).startsWith("..") ? absolute : null;
	} catch {
		return null;
	}
}

function runFd(fdPath: string, args: readonly string[], signal: AbortSignal): Promise<string[] | null> {
	if (signal.aborted) return Promise.resolve(null);
	const { promise, resolve } = Promise.withResolvers<string[] | null>();
	const child = spawn(fdPath, args, { stdio: ["ignore", "pipe", "pipe"] });
	let stdout = "";
	let settled = false;
	const timeout = setTimeout(() => child.kill("SIGKILL"), FD_SEARCH_TIMEOUT_MS);
	const finish = (lines: string[] | null) => {
		if (settled) return;
		settled = true;
		clearTimeout(timeout);
		signal.removeEventListener("abort", abort);
		resolve(lines);
	};
	const abort = () => child.kill("SIGKILL");
	signal.addEventListener("abort", abort, { once: true });
	child.stdout.setEncoding("utf-8");
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
	});
	child.on("error", () => finish(null));
	child.on("close", (code) => {
		if (code !== 0 || signal.aborted) return finish(null);
		finish(stdout ? stdout.split("\n").map((line) => line.trimEnd()).filter(Boolean) : []);
	});
	return promise;
}

function scoreEntry(filePath: string, query: string, isDirectory: boolean): number {
	const fileName = basename(filePath);
	const lowerFileName = fileName.toLowerCase();
	const lowerQuery = query.toLowerCase();
	let score = 0;
	if (lowerFileName === lowerQuery) score = 100;
	else if (lowerFileName.startsWith(lowerQuery)) score = 80;
	else if (lowerFileName.includes(lowerQuery)) score = 50;
	else if (filePath.toLowerCase().includes(lowerQuery)) score = 30;
	if (isDirectory && score > 0) score += 10;
	return score;
}

/** 把 fd 输出的相对路径行按相关性打分并截断为 top 20。纯函数，便于测试。 */
export function rankFdResults(lines: readonly string[], query: string): SearchItem[] {
	const scored = lines
		.map((line) => {
			const hasTrailingSeparator = line.endsWith("/");
			const normalizedPath = hasTrailingSeparator ? line.slice(0, -1) : line;
			if (isHiddenPath(normalizedPath)) return null;
			return {
				item: {
					path: normalizedPath,
					isDirectory: hasTrailingSeparator,
				},
				score: scoreEntry(normalizedPath, query, hasTrailingSeparator),
			};
		})
		.filter((entry): entry is NonNullable<typeof entry> => entry !== null && entry.score > 0)
		.sort((left, right) => right.score - left.score);
	return scored.slice(0, FD_TOP_RESULTS).map(({ item }) => item);
}

async function fuzzySearchWithFd(
	fdPath: string,
	root: string,
	query: string,
	signal: AbortSignal,
): Promise<SearchItem[] | null> {
	const args = [
		"--base-directory",
		root,
		"--max-results",
		String(FD_MAX_RESULTS),
		"--type",
		"f",
		"--type",
		"d",
		"--hidden",
		...FD_EXCLUDE_ARGS,
		query,
	];
	const lines = await runFd(fdPath, args, signal);
	return lines === null ? null : rankFdResults(lines, query);
}

/**
 * 工作区文件搜索（filemention 数据源）。
 *
 * - query 含 `/`：确定路径语义，单层目录前缀匹配，不依赖 fd。
 * - query 无 `/`：fd 全项目模糊搜索（固定排除内部目录、max-results 截断、top-20 打分）。
 * - fd 不可用：降级为工作区根单层前缀匹配，并标记 degraded 供 UI 提示。
 */
export async function searchWorkspaceFiles(input: PiFileSearchRequest): Promise<PiFileSearchResult> {
	const root = await realpath(resolveWorkspacePath(input.workspacePath));
	activeSearches.get(root)?.abort();
	const controller = new AbortController();
	activeSearches.set(root, controller);
	try {
		const query = input.query;
		if (query === "") {
			return toSearchResult(false, await listDirectoryPrefix(root, ".", "", controller.signal));
		}
		const slashIndex = query.lastIndexOf("/");
		if (slashIndex !== -1) {
			const directory = query.slice(0, slashIndex) || ".";
			const fragment = query.slice(slashIndex + 1);
			return toSearchResult(false, await listDirectoryPrefix(root, directory, fragment, controller.signal));
		}
		const fdPath = await ensureFd();
		if (fdPath) {
			const items = await fuzzySearchWithFd(fdPath, root, query, controller.signal);
			if (items) return toSearchResult(false, items);
		}
		return toSearchResult(true, await listDirectoryPrefix(root, ".", query, controller.signal));
	} finally {
		if (activeSearches.get(root) === controller) activeSearches.delete(root);
	}
}
