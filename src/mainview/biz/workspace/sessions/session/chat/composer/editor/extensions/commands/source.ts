import fuzzysort from "fuzzysort";
import type { CommandDefinition } from "./model";

const COMMANDS: readonly CommandDefinition[] = [
	{ description: "新建并切换到空白会话", id: "new", name: "new" },
	{ description: "复制当前活动分支到独立会话", id: "fork", name: "fork" },
	{ description: "删除当前会话并新建会话", id: "drop", name: "drop" },
	{ description: "压缩当前会话的上下文", id: "compact", name: "compact" },
	{ description: "打开应用设置", id: "settings", name: "settings" },
	{ description: "连接或重新配置模型提供商", id: "login", name: "login" },
	{ description: "管理模型提供商认证", id: "logout", name: "logout" },
];

function normalize(value: string): string {
	return value.trim().normalize("NFKC").toLocaleLowerCase();
}

export interface CommandSource {
	search: (query: string) => readonly CommandDefinition[];
}

export const commandSource: CommandSource = {
	search(query) {
		const normalizedQuery = normalize(query);
		if (normalizedQuery === "") return COMMANDS;
		return fuzzysort.go(normalizedQuery, COMMANDS, {
			keys: [
				(command) => normalize(command.name),
				(command) => normalize(command.description),
			],
		}).map(({ obj }) => obj);
	},
};
