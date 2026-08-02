import type { SkillDefinition } from "./model";

const MOCK_SKILLS: readonly SkillDefinition[] = [
	{ description: "审查实现质量、风险与回归", name: "code-review" },
	{ description: "设计并实现高质量前端界面", name: "frontend-design" },
	{ description: "读取、生成和编辑 PDF", name: "pdf" },
	{ description: "在不改变行为的前提下重构代码", name: "refactor" },
	{ description: "以行为测试驱动功能实现", name: "test-driven-development" },
	{ description: "提供 UI 与交互设计建议", name: "ui-ux-pro-max" },
];

export interface SkillSource {
	search: (query: string) => readonly SkillDefinition[];
}

export const skillSource: SkillSource = {
	search(query) {
		const normalizedQuery = query.toLocaleLowerCase();
		if (normalizedQuery === "") return MOCK_SKILLS;
		return MOCK_SKILLS.filter(({ name }) => name.toLocaleLowerCase().includes(normalizedQuery));
	},
};
