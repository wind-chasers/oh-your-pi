import type { CommandDefinition } from "./model";

const MOCK_COMMANDS: readonly CommandDefinition[] = [
	{ description: "解释当前上下文中的实现", name: "explain" },
	{ description: "修复当前问题", name: "fix" },
	{ description: "审查当前变更", name: "review" },
	{ description: "总结当前上下文", name: "summarize" },
	{ description: "运行相关验证", name: "test" },
];

export interface CommandSource {
	search: (query: string) => readonly CommandDefinition[];
}

export const commandSource: CommandSource = {
	search(query) {
		const normalizedQuery = query.toLocaleLowerCase();
		if (normalizedQuery === "") return MOCK_COMMANDS;
		return MOCK_COMMANDS.filter(({ name }) => name.toLocaleLowerCase().includes(normalizedQuery));
	},
};
