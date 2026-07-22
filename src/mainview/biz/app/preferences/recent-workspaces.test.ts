import { describe, expect, test } from "bun:test";
import { updateRecentWorkspaces } from "./recent-workspaces";

describe("工作区列表", () => {
	test("选择已有工作区时保持原有顺序", () => {
		expect(
			updateRecentWorkspaces(
				["/work/alpha", "/work/beta", "/work/gamma"],
				"/work/beta",
			),
		).toEqual(["/work/alpha", "/work/beta", "/work/gamma"]);
	});

	test("新工作区追加到列表末尾并保留最近五项", () => {
		expect(
			updateRecentWorkspaces(
				["/work/a", "/work/b", "/work/c", "/work/d", "/work/e"],
				"/work/f",
			),
		).toEqual(["/work/b", "/work/c", "/work/d", "/work/e", "/work/f"]);
	});
});
