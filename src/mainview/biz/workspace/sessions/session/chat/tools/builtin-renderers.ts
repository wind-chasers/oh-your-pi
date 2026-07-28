import type { ToolCallItem, ToolRenderer } from "./types";

function stringInput(toolCall: ToolCallItem, key: string): string {
	const value = toolCall.input[key];
	return typeof value === "string" ? value : "";
}

function short(value: string, length = 64): string {
	const line = value.trim().split("\n", 1)[0] ?? "";
	return line.length > length ? `${line.slice(0, length - 1)}…` : line;
}

function fileName(path: string): string {
	const segments = path.split(/[\\/]/).filter(Boolean);
	return segments[segments.length - 1] ?? path;
}

function pathLabel(name: string): ToolRenderer["getLabel"] {
	return (toolCall) => {
		const path = stringInput(toolCall, "path") || stringInput(toolCall, "file_path");
		return path ? `${name}: ${fileName(path)}` : name;
	};
}

function pathInput(toolCall: ToolCallItem): string {
	const path = stringInput(toolCall, "path") || stringInput(toolCall, "file_path");
	const offset = toolCall.input.offset;
	const limit = toolCall.input.limit;
	const range = [
		typeof offset === "number" ? `offset=${offset}` : "",
		typeof limit === "number" ? `limit=${limit}` : "",
	].filter(Boolean).join(" · ");
	return [path, range].filter(Boolean).join("\n");
}

const bashRenderer: ToolRenderer = {
	getLabel: (toolCall) => {
		const command = stringInput(toolCall, "command");
		return command ? `bash: ${short(command)}` : "bash";
	},
	getInputText: (toolCall) => stringInput(toolCall, "command"),
};

const grepRenderer: ToolRenderer = {
	getLabel: (toolCall) => {
		const pattern = stringInput(toolCall, "pattern");
		return pattern ? `grep: ${short(pattern, 48)}` : "grep";
	},
};

const findRenderer: ToolRenderer = {
	getLabel: (toolCall) => {
		const pattern = stringInput(toolCall, "pattern") || stringInput(toolCall, "glob");
		return pattern ? `find: ${short(pattern, 48)}` : "find";
	},
};

export const BUILTIN_TOOL_RENDERERS: Readonly<Record<string, ToolRenderer>> = {
	bash: bashRenderer,
	edit: { getLabel: pathLabel("edit") },
	find: findRenderer,
	grep: grepRenderer,
	ls: { getLabel: pathLabel("ls"), getInputText: pathInput },
	read: { getLabel: pathLabel("read"), getInputText: pathInput },
	write: { getLabel: pathLabel("write") },
};
