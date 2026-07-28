import { expect, test } from "bun:test";
import { classifyPiError } from "./errors";

test("仅识别 Pi 的 OAuth 刷新与派生失败", () => {
	expect(classifyPiError(new Error("OAuth refresh failed for github-copilot"))).toBe("authentication-resolution-failed");
	expect(classifyPiError(new Error("OAuth auth derivation failed for github-copilot"))).toBe("authentication-resolution-failed");
	expect(classifyPiError(new Error("rate limit exceeded"))).toBe("unknown");
});
