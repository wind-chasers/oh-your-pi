import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueuedInputs } from "./QueuedInputs";

test("区分 steer 与 follow-up 的交付状态", () => {
	const html = renderToStaticMarkup(
		<QueuedInputs
			items={{
				steering: [{
					state: "submitting",
					message: { clientId: "s1", text: "不要改测试", images: [] },
				}],
				followUps: [{
					state: "queued",
					message: { clientId: "f1", text: "完成后总结", images: [] },
				}],
			}}
		/>,
	);

	expect(html).toContain("调整当前任务");
	expect(html).toContain("后续任务");
	expect(html.indexOf("调整当前任务")).toBeLessThan(html.indexOf("后续任务"));
	expect(html).toContain("发送中");
	expect(html).toContain("已排队");
	expect(html).toContain("不要改测试");
	expect(html).toContain("完成后总结");
});
