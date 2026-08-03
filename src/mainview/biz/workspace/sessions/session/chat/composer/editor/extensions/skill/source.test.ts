import { describe, expect, test } from "bun:test";
import { filterSkills } from "./source";

const skills = [
	{ description: "审查实现质量、风险与回归", name: "code-review" },
	{ description: "设计并实现高质量前端界面", name: "frontend-design" },
	{ description: "提供 UI 与交互设计建议", name: "ui-ux-pro-max" },
];

describe("filterSkills", () => {
	test("returns all skills in stable name order for an empty query", () => {
		expect(filterSkills(skills, "").map(({ name }) => name)).toEqual([
			"code-review",
			"frontend-design",
			"ui-ux-pro-max",
		]);
	});

	test("matches non-contiguous name characters", () => {
		expect(filterSkills(skills, "uxpm").map(({ name }) => name)).toEqual(["ui-ux-pro-max"]);
	});

	test("ranks name matches ahead of description-only matches", () => {
		expect(filterSkills([
		{ description: "包含 frontend 关键字", name: "design-system" },
		{ description: "设计前端界面", name: "frontend-design" },
	], "frontend").map(({ name }) => name)).toEqual([
		"frontend-design",
		"design-system",
	]);
	});

	test("normalizes query case and full-width characters", () => {
		expect(filterSkills(skills, "ＦＲＯＮＴ").map(({ name }) => name)).toEqual(["frontend-design"]);
	});

	test("matches accented names when the query omits diacritics", () => {
		expect(filterSkills([
			{ description: "处理咖啡豆库存", name: "café-tools" },
		], "cafe").map(({ name }) => name)).toEqual(["café-tools"]);
	});
});
