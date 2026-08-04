import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fdAssetName, getFdBinDir, getFdPath } from "./tools";

afterEach(() => {
	delete process.env.PI_OFFLINE;
});

describe("fdAssetName", () => {
	test("macOS arm64 使用 aarch64-apple-darwin tar.gz", () => {
		expect(fdAssetName("10.2.0", "darwin", "arm64")).toBe("fd-v10.2.0-aarch64-apple-darwin.tar.gz");
	});

	test("macOS x64 使用 x86_64-apple-darwin tar.gz", () => {
		expect(fdAssetName("10.2.0", "darwin", "x64")).toBe("fd-v10.2.0-x86_64-apple-darwin.tar.gz");
	});

	test("Linux x64 使用 unknown-linux-gnu tar.gz", () => {
		expect(fdAssetName("10.2.0", "linux", "x64")).toBe("fd-v10.2.0-x86_64-unknown-linux-gnu.tar.gz");
	});

	test("Windows x64 使用 pc-windows-msvc zip", () => {
		expect(fdAssetName("10.2.0", "win32", "x64")).toBe("fd-v10.2.0-x86_64-pc-windows-msvc.zip");
	});

	test("Windows arm64 使用 aarch64-pc-windows-msvc zip", () => {
		expect(fdAssetName("10.2.0", "win32", "arm64")).toBe("fd-v10.2.0-aarch64-pc-windows-msvc.zip");
	});

	test("不支持的平台返回 null", () => {
		expect(fdAssetName("10.2.0", "android" as never, "arm64")).toBeNull();
	});
});

describe("getFdBinDir", () => {
	test("托管目录固定在 agentDir/bin，与 Pi TUI 一致", () => {
		expect(getFdBinDir().endsWith(join(".pi", "agent", "bin"))).toBe(true);
	});
});

describe("getFdPath", () => {
	test("agentDir 托管目录存在时返回该路径", () => {
		const managed = join(getFdBinDir(), process.platform === "win32" ? "fd.exe" : "fd");
		if (!existsSync(managed)) return;
		expect(getFdPath()).toBe(managed);
	});
});
