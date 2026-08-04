import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WithStore } from "@view/atom";
import { unit } from "@view/atom/unit";
import type { EditorInput } from "./framework";

// filemention 插件经 source 依赖 @view/lib/pi-client（渲染进程 RPC 客户端，顶层访问 window）；
// 纯 Node 测试环境需要先装 mock。
mock.module("@view/lib/pi-client", () => ({
	searchPiWorkspaceFiles: async () => ({ degraded: false, items: [] }),
}));

// 动态加载：pi-client mock 必须先于依赖链安装，静态 import 无法满足此顺序。
const { createEditorExtensionRegistry, editorExtensionRegistry } = await import("./extensions");
const { applyEditorTextEdit } = await import("./framework");
const { deriveEditorState, zeroEditorState } = await import("./state");

function input(
	draft: string,
	selectionStart: number,
	insertedText: string | null,
	inputType = "insertText",
): EditorInput {
	return {
		draft,
		inputType,
		insertedText,
		isComposing: false,
		selectionEnd: selectionStart,
		selectionStart,
	};
}

function editor() {
	return deriveEditorState(unit({ ...zeroEditorState }));
}


function trigger(
	instance: ReturnType<typeof editor>,
	draft: string,
	character: "#" | "/" | "@",
): void {
	instance.input(input(draft, draft.length, character));
}

describe("editor extension framework", () => {
	test("空闲态只按本次输入字符激活注册扩展", () => {
		const instance = editor();
		instance.input(input("普通输入", 4, "入"));
		expect(instance.get().active).toBeNull();

		trigger(instance, "输入 @", "@");
		expect(instance.get().active?.extension.id).toBe("file");
		instance.reset();
		trigger(instance, "选择 #", "#");
		expect(instance.get().active?.extension.id).toBe("skill");
		instance.reset();
		trigger(instance, "执行 /", "/");
		expect(instance.get().active?.extension.id).toBe("command");
	});

	test("InputEvent 元数据缺失时从单字符 draft 增量恢复 trigger", () => {
		for (const [character, extensionId] of [
			["@", "file"],
			["#", "skill"],
			["/", "command"],
		] as const) {
			for (const inputType of ["insertText", ""]) {
				const instance = editor();
				instance.input(input(character, 1, null, inputType));
				expect(instance.get().active?.extension.id).toBe(extensionId);
				expect(instance.get().active?.extension).toBe(
					editorExtensionRegistry.byTrigger.get(character),
				);
			}
		}
	});

	test("忽略已同步 draft 的 DOM input 回声", () => {
		const instance = editor();
		trigger(instance, "@", "@");
		instance.command({ type: "cancel" });

		instance.input(input("@", 1, "@"));
		expect(instance.get().active).toBeNull();
	});

	test("组合输入的临时选区不会关闭活跃扩展", () => {
		const instance = editor();
		trigger(instance, "@", "@");
		instance.input({
			draft: "@zh",
			inputType: "insertCompositionText",
			insertedText: "zh",
			isComposing: true,
			selectionEnd: 3,
			selectionStart: 1,
		});
		expect(instance.get()).toMatchObject({
			active: { extension: { id: "file" }, state: { query: "" } },
			draft: "@zh",
		});

		instance.input({
			draft: "@中",
			inputType: "insertFromComposition",
			insertedText: "中",
			isComposing: false,
			selectionEnd: 2,
			selectionStart: 2,
		});
		expect(instance.get()).toMatchObject({
			active: { extension: { id: "file" }, state: { query: "中" } },
			draft: "@中",
		});
	});

	test("注册表不向 framework 暴露候选数据类型", () => {
		expect(editorExtensionRegistry.byTrigger.get("@")?.id).toBe("file");
		expect(editorExtensionRegistry.byTrigger.get("#")?.id).toBe("skill");
		expect(editorExtensionRegistry.byTrigger.get("/")?.id).toBe("command");
	});

	test("注册表拒绝重复 id 与 trigger", () => {
		const file = editorExtensionRegistry.byTrigger.get("@");
		const skill = editorExtensionRegistry.byTrigger.get("#");
		if (!file || !skill) throw new Error("Expected registered editor extensions");
		expect(() => createEditorExtensionRegistry([file, file])).toThrow("Duplicate editor extension id");
		const duplicateTrigger = { ...skill, id: "other", triggers: ["@"] };
		expect(() => createEditorExtensionRegistry([file, duplicateTrigger])).toThrow("Duplicate editor extension trigger");
	});

	test("每个扩展渲染自己的完整 Panel", () => {
		for (const [triggerCharacter, extensionId, expectedText] of [
			["@", "file", "引用文件"],
			["#", "skill", "选择 Skill"],
			["/", "command", "运行指令"],
		] as const) {
			const instance = editor();
			trigger(instance, triggerCharacter, triggerCharacter);
			const active = instance.get().active;
			if (!active) throw new Error(`Expected ${extensionId} extension to be active`);
			const extension = active.extension;
			const html = renderToStaticMarkup(createElement(
				WithStore,
				null,
				createElement(extension.Panel, {
					dispatch: () => {},
					state: active.state,
				}),
			));
			expect(html).toContain(expectedText);
		}
	});

	test("活跃扩展自行决定 token 阻断规则", () => {
		const file = editor();
		trigger(file, "@", "@");
		file.input(input("@src/main/a.ts", 14, "s"));
		expect(file.get().active?.extension.id).toBe("file");
		file.input(input("@src/main:a.ts", 14, "s"));
		expect(file.get().active).toBeNull();

		const skill = editor();
		trigger(skill, "#", "#");
		skill.input(input("#namespace:skill", 16, "l"));
		expect(skill.get().active?.extension.id).toBe("skill");
		skill.input(input("#namespace/skill", 16, "l"));
		expect(skill.get().active).toBeNull();
	});

	test("光标离开 token 或创建选区时关闭当前扩展", () => {
		const instance = editor();
		trigger(instance, "@", "@");
		instance.input(input("@src/a", 6, "a"));
		instance.selectionChange(0, 0);
		expect(instance.get().active).toBeNull();

		trigger(instance, "@src/a @", "@");
		instance.selectionChange(7, 9);
		expect(instance.get().active).toBeNull();
	});

	test("扩展拥有各自的接受事务", () => {
		const file = editor();
		trigger(file, "@", "@");
		file.input(input("@src/a", 6, "a"));
		// file 候选来自异步 RPC：先注入搜索结果再接受。
		file.dispatchExtensionEvent({
			type: "search",
			files: [{ path: "src/a.ts" }],
			query: "src/a",
			status: "ready",
		});
		expect(file.command({ type: "accept", source: "enter" })).toBeTrue();
		expect(file.get()).toEqual({ active: null, draft: "@src/a.ts" });

		const skill = editor();
		trigger(skill, "#", "#");
		skill.input(input("#front", 6, "t"));
		skill.dispatchExtensionEvent({
			type: "results",
			query: "front",
			skills: [{ description: "设计并实现高质量前端界面", name: "frontend-design" }],
		});
		expect(skill.command({ type: "accept", source: "tab" })).toBeTrue();
		expect(skill.get()).toEqual({ active: null, draft: "[#skill:frontend-design]" });

		const command = editor();
		trigger(command, "/", "/");
		command.input(input("/new", 4, "w"));
		expect(command.command({ type: "accept", source: "enter" })).toBeTrue();
		expect(command.get()).toEqual({ active: null, draft: "" });
	});

	test("命令 Tab 补全后保持浮层，完整匹配时放行", () => {
		const instance = editor();
		trigger(instance, "/", "/");
		instance.input(input("/comp", 5, "p"));

		expect(instance.command({ type: "accept", source: "tab" })).toBeTrue();
		expect(instance.get()).toMatchObject({
			active: { extension: { id: "command" }, state: { query: "compact", tokenEnd: 8 } },
			draft: "/compact",
		});
		expect(instance.command({ type: "accept", source: "tab" })).toBeFalse();
	});

	test("语义导航和取消由当前扩展处理", () => {
		const instance = editor();
		trigger(instance, "#", "#");
		instance.dispatchExtensionEvent({
			type: "results",
			query: "",
			skills: [{ description: "审查实现质量", name: "code-review" }],
		});
		expect(instance.command({ type: "navigate", direction: "next" })).toBeTrue();
		expect(instance.command({ type: "cancel" })).toBeTrue();
		expect(instance.get().active).toBeNull();
	});
});

describe("editor transactions", () => {
	test("framework 统一应用并校验文本编辑", () => {
		expect(applyEditorTextEdit("hello @a", {
			cursor: 12,
			from: 7,
			insert: "src/a.ts",
			to: 8,
		})).toBe("hello @src/a.ts");
		expect(() => applyEditorTextEdit("abc", {
			cursor: 0,
			from: 2,
			insert: "",
			to: 1,
		})).toThrow(RangeError);
	});
});
