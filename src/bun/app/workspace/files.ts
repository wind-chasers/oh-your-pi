import { open, readdir, realpath, stat } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import type { PiWorkspaceFile, PiWorkspaceFileContent, PiWorkspaceFileRequest } from "@shared/pi-contract";

const MAX_FILE_BYTES = 512 * 1024;
const HIDDEN_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", ".next"]);

export async function listWorkspaceFiles(input: PiWorkspaceFileRequest): Promise<PiWorkspaceFile[]> {
	const directory = await resolveExistingWorkspacePath(input.workspacePath, input.relativePath);
	const entries = await readdir(directory, { withFileTypes: true });
	return entries
		.filter((entry) => !HIDDEN_DIRECTORIES.has(entry.name))
		.map((entry) => ({
			name: entry.name,
			path: toRelativePath(input.relativePath, entry.name),
			type: entry.isDirectory() ? "directory" as const : "file" as const,
		}))
		.sort((left, right) => {
			if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
			return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
		});
}

export async function readWorkspaceFile(input: PiWorkspaceFileRequest): Promise<PiWorkspaceFileContent> {
	if (!input.relativePath) throw new Error("请选择要预览的文件。");
	const filePath = await resolveExistingWorkspacePath(input.workspacePath, input.relativePath);
	const fileStat = await stat(filePath);
	if (!fileStat.isFile()) throw new Error("所选路径不是文件。");
	const content = await readFilePrefix(filePath, fileStat.size);
	const isBinary = content.includes(0);
	return {
		content: isBinary ? "此文件包含二进制内容，无法预览。" : content.toString("utf8"),
		isBinary,
		isTruncated: fileStat.size > MAX_FILE_BYTES,
		path: input.relativePath,
	};
}

export function resolveWorkspacePath(workspacePath: string, relativePath?: string): string {
	const root = resolve(workspacePath);
	const candidate = resolve(root, relativePath ?? ".");
	if (candidate !== root && relative(root, candidate).startsWith("..")) {
		throw new Error("文件路径必须位于当前工作区内。");
	}
	return candidate;
}

async function readFilePrefix(filePath: string, size: number): Promise<Buffer> {
	const bytesToRead = Math.min(size, MAX_FILE_BYTES);
	const file = await open(filePath, "r");
	try {
		const content = Buffer.allocUnsafe(bytesToRead);
		const { bytesRead } = await file.read(content, 0, bytesToRead, 0);
		return content.subarray(0, bytesRead);
	} finally {
		await file.close();
	}
}

async function resolveExistingWorkspacePath(workspacePath: string, relativePath?: string): Promise<string> {
	const root = await realpath(resolveWorkspacePath(workspacePath));
	const candidate = await realpath(resolveWorkspacePath(workspacePath, relativePath));
	if (candidate !== root && relative(root, candidate).startsWith("..")) {
		throw new Error("文件路径必须位于当前工作区内。");
	}
	return candidate;
}

function toRelativePath(parentPath: string | undefined, name: string): string {
	return parentPath ? `${parentPath}/${name}` : basename(name);
}
