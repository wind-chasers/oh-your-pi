import { expect, test } from "bun:test";
import type { ApplicationMenuItemConfig } from "electrobun/bun";
import { createApplicationMenu, OPEN_APP_SETTINGS_ACTION } from "./application-menu";

function flattenMenu(items: ApplicationMenuItemConfig[]): ApplicationMenuItemConfig[] {
	return items.flatMap((item) =>
		"submenu" in item && item.submenu
			? [item, ...flattenMenu(item.submenu)]
			: [item],
	);
}

test("应用菜单注册系统编辑和窗口角色", () => {
	const items = flattenMenu(createApplicationMenu());
	const roles = items.flatMap((item) =>
		"role" in item && item.role ? [item.role] : [],
	);

	for (const role of [
		"close",
		"copy",
		"cut",
		"hide",
		"minimize",
		"paste",
		"quit",
		"redo",
		"selectAll",
		"undo",
	]) {
		expect(roles).toContain(role);
	}
});

test("应用级系统角色显式注册键位", () => {
	const items = flattenMenu(createApplicationMenu());
	const shortcuts = {
		close: "CommandOrControl+W",
		hide: "CommandOrControl+H",
		hideOthers: "Alt+CommandOrControl+H",
		minimize: "CommandOrControl+M",
		quit: "CommandOrControl+Q",
	};

	for (const [role, accelerator] of Object.entries(shortcuts)) {
		const item = items.find(
			(candidate) => "role" in candidate && candidate.role === role,
		);
		expect(item).toMatchObject({ accelerator });
	}
});

test("设置菜单使用系统偏好设置快捷键", () => {
	const settings = flattenMenu(createApplicationMenu()).find(
		(item) => "action" in item && item.action === OPEN_APP_SETTINGS_ACTION,
	);

	expect(settings).toMatchObject({ accelerator: "CommandOrControl+," });
});
