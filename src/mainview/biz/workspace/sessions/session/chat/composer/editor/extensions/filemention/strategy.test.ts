import { describe, expect, test } from "bun:test";
import type { EditorExtensionEvent } from "../../framework";
import {
	activateFileMention,
	handleFileMentionCommand,
	handleFileMentionPanelEvent,
	transitionFileMention,
} from "./strategy";
import type { FileMentionPanelEvent, FileMentionState } from "./model";

const file = (path: string, isDirectory = false) => ({ isDirectory, path });

function state(overrides: Partial<FileMentionState> = {}): FileMentionState {
	return {
		activeIndex: 0,
		files: [],
		query: "",
		status: "ready",
		tokenEnd: 1,
		trigger: "@",
		triggerIndex: 0,
		...overrides,
	};
}

const inputEvent = (draft: string): EditorExtensionEvent => ({
	type: "input",
	input: {
		draft,
		inputType: "insertText",
		insertedText: draft[draft.length - 1] ?? null,
		isComposing: false,
		selectionEnd: draft.length,
		selectionStart: draft.length,
	},
});

describe("activateFileMention", () => {
	test("starts in loading state with an empty candidate list", () => {
		const active = activateFileMention({
			draft: "@",
			input: {
				draft: "@",
				inputType: "insertText",
				insertedText: "@",
				isComposing: false,
				selectionEnd: 1,
				selectionStart: 1,
			},
			triggerIndex: 0,
		});
		expect(active).toEqual({
			activeIndex: 0,
			files: [],
			query: "",
			status: "loading",
			tokenEnd: 1,
			trigger: "@",
			triggerIndex: 0,
		});
	});

	test("returns null when the trigger character is not at the trigger index", () => {
		const active = activateFileMention({
			draft: "xa",
			input: {
				draft: "xa",
				inputType: "insertText",
				insertedText: "a",
				isComposing: false,
				selectionEnd: 2,
				selectionStart: 2,
			},
			triggerIndex: 0,
		});
		expect(active).toBeNull();
	});
});

describe("transitionFileMention", () => {
	test("resets candidates to loading when the query changes", () => {
		const transition = transitionFileMention(
			state({ files: [file("a.ts")], query: "a", status: "ready", tokenEnd: 2 }),
			inputEvent("@ab"),
			"@ab",
		);
		expect(transition).toEqual({
			type: "update",
			state: {
				activeIndex: 0,
				files: [],
				query: "ab",
				status: "loading",
				tokenEnd: 3,
				trigger: "@",
				triggerIndex: 0,
			},
		});
	});

	test("keeps candidates when the query is unchanged", () => {
		const files = [file("a.ts")];
		const transition = transitionFileMention(
			state({ files, query: "a", status: "ready", tokenEnd: 2 }),
			inputEvent("@a"),
			"@a",
		);
		expect(transition).toEqual({ type: "update", state: state({ files, query: "a", tokenEnd: 2 }) });
	});

	test("closes when the cursor moves before the trigger", () => {
		const transition = transitionFileMention(
			state({ query: "a", tokenEnd: 2 }),
			{ type: "selection", selectionEnd: 0, selectionStart: 0 },
			"@a",
		);
		expect(transition).toEqual({ type: "close" });
	});
});

describe("handleFileMentionCommand", () => {
	test("cancel closes the extension", () => {
		expect(handleFileMentionCommand(state(), { type: "cancel" })).toEqual({ type: "close" });
	});

	test("navigate with no candidates is ignored", () => {
		expect(handleFileMentionCommand(state(), { type: "navigate", direction: "next" })).toEqual({
			type: "ignore",
		});
	});

	test("navigate cycles through candidates", () => {
		const files = [file("a.ts"), file("b.ts")];
		const result = handleFileMentionCommand(
			state({ activeIndex: 0, files }),
			{ type: "navigate", direction: "next" },
		);
		expect(result).toEqual({ type: "update", state: state({ activeIndex: 1, files }) });
	});

	test("accept inserts the file path and closes", () => {
		const files = [file("src/a.ts")];
		const result = handleFileMentionCommand(
			state({ files, query: "a", tokenEnd: 2 }),
			{ type: "accept", source: "enter" },
		);
		expect(result).toEqual({
			type: "transaction",
			transaction: {
				close: true,
				edit: {
					cursor: 9,
					from: 1,
					insert: "src/a.ts",
					to: 2,
				},
			},
			state: undefined,
		});
	});

	test("accepting a directory keeps the token open for further typing", () => {
		const files = [file("src", true)];
		const result = handleFileMentionCommand(
			state({ files, query: "s", tokenEnd: 2 }),
			{ type: "accept", source: "tab" },
		);
		expect(result).toEqual({
			type: "transaction",
			transaction: {
				close: false,
				edit: {
					cursor: 5,
					from: 1,
					insert: "src/",
					to: 2,
				},
			},
			state: {
				activeIndex: 0,
				files: [],
				query: "src/",
				status: "loading",
				tokenEnd: 5,
				trigger: "@",
				triggerIndex: 0,
			},
		});
	});

	test("accept with no candidate is ignored", () => {
		expect(handleFileMentionCommand(state(), { type: "accept", source: "enter" })).toEqual({
			type: "ignore",
		});
	});
});

describe("handleFileMentionPanelEvent", () => {
	test("search results update candidates and status", () => {
		const files = [file("a.ts")];
		const event: FileMentionPanelEvent = {
			type: "search",
			files,
			query: "a",
			status: "ready",
		};
		expect(handleFileMentionPanelEvent(state({ query: "a" }), event)).toEqual({
			type: "update",
			state: state({ files, query: "a" }),
		});
	});

	test("stale search results for an outdated query are ignored", () => {
		const event: FileMentionPanelEvent = {
			type: "search",
			files: [file("a.ts")],
			query: "old",
			status: "ready",
		};
		expect(handleFileMentionPanelEvent(state({ query: "new" }), event)).toEqual({ type: "ignore" });
	});

	test("hover outside the candidate range is ignored", () => {
		expect(handleFileMentionPanelEvent(state(), { type: "hover", index: 0 })).toEqual({
			type: "ignore",
		});
	});

	test("hover moves the active index", () => {
		const files = [file("a.ts"), file("b.ts")];
		expect(handleFileMentionPanelEvent(state({ files }), { type: "hover", index: 1 })).toEqual({
			type: "update",
			state: state({ activeIndex: 1, files }),
		});
	});

	test("select of an unknown path is ignored", () => {
		expect(handleFileMentionPanelEvent(state(), { type: "select", path: "x.ts" })).toEqual({
			type: "ignore",
		});
	});

	test("select accepts the matching file", () => {
		const files = [file("src/a.ts")];
		const result = handleFileMentionPanelEvent(
			state({ files, query: "a", tokenEnd: 2 }),
			{ type: "select", path: "src/a.ts" },
		);
		expect(result).toMatchObject({
			type: "transaction",
			transaction: { close: true, edit: { insert: "src/a.ts", to: 2 } },
		});
	});
});
