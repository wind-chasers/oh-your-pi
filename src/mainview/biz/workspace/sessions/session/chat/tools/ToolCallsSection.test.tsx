import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "@view/components/ui/tooltip";
import { ToolCallsSection } from "./ToolCallsSection";
import type { ToolCallItem } from "./types";

const toolCalls: ToolCallItem[] = [
	{
		id: "bash-1",
		input: { command: "bun run typecheck" },
		isError: false,
		name: "bash",
		output: "Done",
		executionStatus: "completed",
	},
	{
		id: "write-1",
		input: { path: "/workspace/src/tool.ts" },
		isError: null,
		name: "write",
		output: null,
		executionStatus: "running",
	},
];

test("折叠视图展示工具摘要与可访问状态", () => {
	const html = renderToStaticMarkup(
		<TooltipProvider>
			<ToolCallsSection toolCalls={toolCalls} />
		</TooltipProvider>,
	);

	expect(html).toContain("bash: bun run typecheck");
	expect(html).toContain("write: tool.ts");
	expect(html).toContain("bash: bun run typecheck，已完成");
	expect(html).toContain("write: tool.ts，执行中");
	expect(html).toContain("全部");
});
