import { BUILTIN_TOOL_RENDERERS } from "./builtin-renderers";
import type { ToolRenderer } from "./types";

const renderers = new Map<string, ToolRenderer>(Object.entries(BUILTIN_TOOL_RENDERERS));

export function registerToolRenderer(toolName: string, renderer: ToolRenderer): void {
	renderers.set(toolName, renderer);
}

export function resolveToolRenderer(toolName: string): ToolRenderer | undefined {
	return renderers.get(toolName);
}
