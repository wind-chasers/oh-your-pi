import { describe, expect, test } from "bun:test";
import type { EditorExtensionEvent, EditorInput } from "../../framework";
import {
	activateSkill,
	handleSkillCommand,
	handleSkillPanelEvent,
	transitionSkill,
} from "./strategy";
import type { SkillDefinition, SkillExtensionState } from "./model";

const frontend: SkillDefinition = {
	description: "设计并实现高质量前端界面",
	name: "frontend-design",
};

function state(overrides: Partial<SkillExtensionState> = {}): SkillExtensionState {
	return {
		activeIndex: 0,
		query: "",
		skills: [],
		tokenEnd: 1,
		trigger: "#",
		triggerIndex: 0,
		...overrides,
	};
}

function input(draft: string): EditorInput {
	return {
		draft,
		inputType: "insertText",
		insertedText: draft[draft.length - 1] ?? null,
		isComposing: false,
		selectionEnd: draft.length,
		selectionStart: draft.length,
	};
}

function inputEvent(draft: string): EditorExtensionEvent {
	return { type: "input", input: input(draft) };
}

describe("Skill extension strategy", () => {
	test("activates with no stale candidates", () => {
		expect(activateSkill({
			draft: "#",
			input: input("#"),
			triggerIndex: 0,
		})).toEqual(state());
	});

	test("clears candidates when the query changes", () => {
		expect(transitionSkill(
			state({ query: "front", skills: [frontend], tokenEnd: 6 }),
			inputEvent("#fronte"),
			"#fronte",
		)).toEqual({
			type: "update",
			state: state({ query: "fronte", tokenEnd: 7 }),
		});
	});

	test("ignores results for an outdated query", () => {
		expect(handleSkillPanelEvent(
		state({ query: "front" }),
		{ type: "results", query: "old", skills: [frontend] },
	)).toEqual({ type: "ignore" });
	});

	test("accepts the candidate stored by the panel", () => {
		const withResults = handleSkillPanelEvent(
			state({ query: "front", tokenEnd: 6 }),
			{ type: "results", query: "front", skills: [frontend] },
		);
		expect(withResults).toEqual({
			type: "update",
			state: state({ query: "front", skills: [frontend], tokenEnd: 6 }),
		});

		if (withResults.type !== "update") throw new Error("Expected result update");
		expect(handleSkillCommand(withResults.state, { type: "accept", source: "enter" })).toEqual({
			type: "transaction",
			transaction: {
				close: true,
				edit: { cursor: 24, from: 0, insert: "[#skill:frontend-design]", to: 6 },
			},
		});
	});
});
