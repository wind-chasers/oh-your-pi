import { expect, test } from "bun:test";
import { isOAuthResolutionFailure, toRuntimeDiagnostic } from "./diagnostics";

test("仅识别 Pi 的 OAuth 刷新与派生失败", () => {
	expect(isOAuthResolutionFailure(new Error("OAuth refresh failed for github-copilot"))).toBe(true);
	expect(isOAuthResolutionFailure(new Error("OAuth auth derivation failed for github-copilot"))).toBe(true);
	expect(isOAuthResolutionFailure(new Error("rate limit exceeded"))).toBe(false);
});

test("诊断只包含 auth 文件元数据并脱敏错误", () => {
	const diagnostic = toRuntimeDiagnostic({
		agentDir: "/Users/test/.pi/agent",
		authError: new Error("token=super-secret-value"),
		authFileAfter: { exists: true, mtimeMs: 200, size: 100 },
		authFileBefore: { exists: true, mtimeMs: 100, size: 99 },
		authStatus: "error",
		modelId: "claude-opus-4.8",
		provider: "github-copilot",
		sessionPath: "/tmp/session.jsonl",
		workspacePath: "/tmp/workspace",
	});

	const serialized = JSON.stringify(diagnostic);
	expect(serialized).not.toContain("super-secret-value");
	expect(diagnostic).toMatchObject({
		auth: {
			authFile: { exists: true, mtimeMs: 200, size: 100 },
			authFileChanged: true,
			errorMessage: "token=[已隐藏]",
		},
	});
});
