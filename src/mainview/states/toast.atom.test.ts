import { expect, test } from "bun:test";
import { createToast, getToastDelay } from "./toast.atom";

test("创建通知时分配递增的稳定标识", () => {
	const first = createToast({ title: "已保存", variant: "success" });
	const second = createToast({
		description: "可在设置中更改。",
		title: "已更新",
		variant: "info",
	});

	expect(second.id).toBeGreaterThan(first.id);
	expect(second).toMatchObject({
		description: "可在设置中更改。",
		title: "已更新",
		variant: "info",
	});
});

test("通知在过期时立即移除", () => {
	const toast = createToast({ title: "已保存", variant: "success" });
	if (toast.expiresAt === null) throw new Error("Expected expiring toast");

	expect(getToastDelay(toast, toast.expiresAt - 100)).toBe(100);
	expect(getToastDelay(toast, toast.expiresAt + 1)).toBe(0);
});

test("持久通知不创建自动关闭延迟", () => {
	const toast = createToast({ duration: null, title: "需要处理", variant: "info" });

	expect(toast.expiresAt).toBeNull();
	expect(getToastDelay(toast)).toBeNull();
});
