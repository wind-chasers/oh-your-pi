import { describe, expect, test } from "bun:test";
import {
	handleCommandCommand,
	handleCommandPanelEvent,
} from "./strategy";
import type { CommandEditorEffect, CommandExtensionState } from "./model";
import { commandSource } from "./source";

const newEffect: CommandEditorEffect = { command: "new", type: "command" };
const dropEffect: CommandEditorEffect = { command: "drop", type: "command" };

function state(overrides: Partial<CommandExtensionState> = {}): CommandExtensionState {
	return {
		activeIndex: 0,
		query: "",
		tokenEnd: 1,
		trigger: "/",
		triggerIndex: 0,
		...overrides,
	};
}

describe("command extension", () => {
	test("键盘接受当前候选并派发命令效果", () => {
		expect(handleCommandCommand(state(), { type: "accept", source: "enter" })).toEqual({
			type: "transaction",
			transaction: {
				close: true,
				edit: { cursor: 0, from: 0, insert: "", to: 1 },
				effect: newEffect,
			},
		});
	});

	test("Tab 只补全当前候选，不执行命令", () => {
		expect(handleCommandCommand(state({ query: "comp", tokenEnd: 5 }), {
			source: "tab",
			type: "accept",
		})).toEqual({
			type: "transaction",
			state: state({ query: "compact", tokenEnd: 8 }),
			transaction: {
				close: false,
				edit: { cursor: 8, from: 1, insert: "compact", to: 5 },
			},
		});
	});

	test("Tab 遇到完整或非前缀候选时放行", () => {
		expect(handleCommandCommand(state({ query: "compact", tokenEnd: 8 }), {
			source: "tab",
			type: "accept",
		})).toEqual({ type: "ignore" });
		expect(handleCommandCommand(state({ query: "ct", tokenEnd: 3 }), {
			source: "tab",
			type: "accept",
		})).toEqual({ type: "ignore" });
	});

	test("鼠标选择按候选 id 执行，不依赖当前高亮项", () => {
		expect(handleCommandPanelEvent(state(), { id: "drop", type: "select" })).toEqual({
			type: "transaction",
			transaction: {
				close: true,
				edit: { cursor: 0, from: 0, insert: "", to: 1 },
				effect: dropEffect,
			},
		});
	});

	test("命令搜索使用本地模糊匹配", () => {
		expect(commandSource.search("set").map((command) => command.id)).toEqual(["settings"]);
	});
});
