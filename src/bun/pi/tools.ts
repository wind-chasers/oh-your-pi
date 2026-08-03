import { spawnSync } from "node:child_process";
import {
	chmodSync,
	createWriteStream,
	existsSync,
	mkdirSync,
	readdirSync,
	renameSync,
	rmSync,
} from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

/**
 * fd 工具管理：探测与按需下载。
 *
 * 逻辑与 Pi Coding Agent 的 `utils/tools-manager.ts`（MIT）保持一致：
 * 探测顺序为 agentDir 托管目录 → 系统 PATH → GitHub releases 下载。
 * 下载目标与 Pi TUI 共用 `~/.pi/agent/bin`，两边共享同一个 fd 缓存。
 * 任何失败都静默降级返回 null，调用方保留纯 JS 单层补全路径。
 */

const NETWORK_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** `~/.pi/agent/bin`（与 Pi TUI 的托管二进制目录一致）。 */
export function getFdBinDir(): string {
	return join(getAgentDir(), "bin");
}

const FD_BINARY_NAME = platform() === "win32" ? "fd.exe" : "fd";

function commandExists(command: string): boolean {
	try {
		const result = spawnSync(command, ["--version"], { stdio: "pipe" });
		return result.error === undefined || result.error === null;
	} catch {
		return false;
	}
}

/** 返回可用的 fd 路径；找不到时返回 null。 */
export function getFdPath(): string | null {
	const managedPath = join(getFdBinDir(), FD_BINARY_NAME);
	if (existsSync(managedPath)) return managedPath;
	for (const name of ["fd", "fdfind"]) {
		if (commandExists(name)) return name;
	}
	return null;
}

export type FdPlatform = "darwin" | "linux" | "win32";
export type FdArchitecture = "arm64" | "x64";

/** fd GitHub release asset 名；不支持的平台返回 null。 */
export function fdAssetName(
	version: string,
	plat: FdPlatform = platform() as FdPlatform,
	architecture: FdArchitecture = arch() as FdArchitecture,
): string | null {
	if (plat === "darwin" || plat === "linux") {
		const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
		if (plat === "darwin") {
			return `fd-v${version}-${archStr}-apple-darwin.tar.gz`;
		}
		return `fd-v${version}-${archStr}-unknown-linux-gnu.tar.gz`;
	}
	if (plat === "win32") {
		const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
		return `fd-v${version}-${archStr}-pc-windows-msvc.zip`;
	}
	return null;
}

async function getLatestFdVersion(): Promise<string> {
	const response = await fetch("https://api.github.com/repos/sharkdp/fd/releases/latest", {
		headers: { "User-Agent": "oh-your-pi" },
		signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
	const data = (await response.json()) as { tag_name: string };
	return data.tag_name.replace(/^v/, "");
}

async function downloadFile(url: string, dest: string): Promise<void> {
	const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
	if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
	if (!response.body) throw new Error("No response body");
	const fileStream = createWriteStream(dest);
	await pipeline(Readable.fromWeb(response.body as never), fileStream);
}

function findBinaryRecursively(rootDir: string, binaryFileName: string): string | null {
	const stack = [rootDir];
	while (stack.length > 0) {
		const currentDir = stack.pop();
		if (!currentDir) continue;
		const entries = readdirSync(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(currentDir, entry.name);
			if (entry.isFile() && entry.name === binaryFileName) return fullPath;
			if (entry.isDirectory()) stack.push(fullPath);
		}
	}
	return null;
}

function extractArchive(archivePath: string, extractDir: string, assetName: string): void {
	if (assetName.endsWith(".tar.gz")) {
		spawnSync("tar", ["xzf", archivePath, "-C", extractDir], { stdio: "pipe" });
		return;
	}
	if (!assetName.endsWith(".zip")) {
		throw new Error(`Unsupported archive format: ${assetName}`);
	}
	if (platform() === "win32") {
		// Windows 自带 bsdtar（tar.exe）支持 zip。
		const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
		const systemTar = systemRoot ? join(systemRoot, "System32", "tar.exe") : undefined;
		const tarResult = spawnSync(systemTar ?? "tar.exe", ["xf", archivePath, "-C", extractDir], { stdio: "pipe" });
		if (!tarResult.error && tarResult.status === 0) return;
		const script = "& { param($archive, $destination) $ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force }";
		const powershellResult = spawnSync("powershell.exe", [
			"-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script,
			archivePath, extractDir,
		], { stdio: "pipe" });
		if (!powershellResult.error && powershellResult.status === 0) return;
		throw new Error(`Failed to extract ${assetName} on Windows`);
	}
	const unzipResult = spawnSync("unzip", ["-q", archivePath, "-d", extractDir], { stdio: "pipe" });
	if (!unzipResult.error && unzipResult.status === 0) return;
	const tarResult = spawnSync("tar", ["xf", archivePath, "-C", extractDir], { stdio: "pipe" });
	if (!tarResult.error && tarResult.status === 0) return;
	throw new Error(`Failed to extract ${assetName}`);
}

async function downloadFd(): Promise<string | null> {
	const plat = platform();
	const architecture = arch();
	// 最新版 fd 不再发布 macOS x64 的官方 asset（或存在兼容问题），Pi 固定该平台版本。
	const version = plat === "darwin" && architecture === "x64" ? "10.3.0" : await getLatestFdVersion();
	const assetName = fdAssetName(version, plat as FdPlatform, architecture as FdArchitecture);
	if (!assetName) return null;

	const binDir = getFdBinDir();
	mkdirSync(binDir, { recursive: true });
	const binaryPath = join(binDir, FD_BINARY_NAME);
	const archivePath = join(binDir, assetName);
	// 唯一临时目录：并发下载（例如多个工作区同时触发）不共享固定目录。
	const extractDir = join(
		binDir,
		`extract_tmp_fd_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
	);
	mkdirSync(extractDir, { recursive: true });

	try {
		await downloadFile(
			`https://github.com/sharkdp/fd/releases/download/v${version}/${assetName}`,
			archivePath,
		);
		extractArchive(archivePath, extractDir, assetName);
		const extractedDir = join(extractDir, assetName.replace(/\.(tar\.gz|zip)$/, ""));
		const candidates = [
			join(extractedDir, FD_BINARY_NAME),
			join(extractDir, FD_BINARY_NAME),
		];
		let extractedBinary = candidates.find((candidate) => existsSync(candidate));
		if (!extractedBinary) {
			extractedBinary = findBinaryRecursively(extractDir, FD_BINARY_NAME) ?? undefined;
		}
		if (!extractedBinary) throw new Error(`Binary not found in archive: ${assetName}`);
		renameSync(extractedBinary, binaryPath);
		if (plat !== "win32") chmodSync(binaryPath, 0o755);
		return binaryPath;
	} finally {
		rmSync(archivePath, { force: true });
		rmSync(extractDir, { recursive: true, force: true });
	}
}

let downloading: Promise<string | null> | null = null;

/**
 * 确保 fd 可用：已存在（托管目录或 PATH）直接返回；否则从 GitHub 下载。
 * 任何失败都返回 null，不抛错；并发调用共享同一次下载。
 */
export function ensureFd(): Promise<string | null> {
	const existing = getFdPath();
	if (existing) return Promise.resolve(existing);
	const offlineValue = process.env.PI_OFFLINE;
	if (offlineValue && (offlineValue === "1" || offlineValue.toLowerCase() === "true" || offlineValue.toLowerCase() === "yes")) {
		return Promise.resolve(null);
	}
	if (downloading) return downloading;
	downloading = downloadFd().finally(() => {
		downloading = null;
	});
	return downloading;
}
