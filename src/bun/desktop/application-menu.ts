import type { ApplicationMenuItemConfig } from "electrobun/bun";

export const OPEN_APP_SETTINGS_ACTION = "open-app-settings";

export function createApplicationMenu(): ApplicationMenuItemConfig[] {
	return [
		{
			submenu: [
				{ label: "关于 Oh Your Pi", role: "about" },
				{ type: "separator" },
				{
					label: "设置…",
					action: OPEN_APP_SETTINGS_ACTION,
					accelerator: "CommandOrControl+,",
				},
				{ type: "separator" },
				{
					label: "隐藏 Oh Your Pi",
					role: "hide",
					accelerator: "CommandOrControl+H",
				},
				{
					label: "隐藏其他",
					role: "hideOthers",
					accelerator: "Alt+CommandOrControl+H",
				},
				{ label: "全部显示", role: "showAll" },
				{ type: "separator" },
				{
					label: "退出 Oh Your Pi",
					role: "quit",
					accelerator: "CommandOrControl+Q",
				},
			],
		},
		{
			label: "文件",
			submenu: [
				{
					label: "关闭窗口",
					role: "close",
					accelerator: "CommandOrControl+W",
				},
			],
		},
		{
			label: "编辑",
			submenu: [
				{ label: "撤销", role: "undo" },
				{ label: "重做", role: "redo" },
				{ type: "separator" },
				{ label: "剪切", role: "cut" },
				{ label: "复制", role: "copy" },
				{ label: "粘贴", role: "paste" },
				{ label: "粘贴并匹配样式", role: "pasteAndMatchStyle" },
				{ label: "删除", role: "delete" },
				{ label: "全选", role: "selectAll" },
			],
		},
		{
			label: "窗口",
			submenu: [
				{
					label: "最小化",
					role: "minimize",
					accelerator: "CommandOrControl+M",
				},
				{ label: "缩放", role: "zoom" },
				{ type: "separator" },
				{ label: "切换全屏", role: "toggleFullScreen" },
				{ type: "separator" },
				{ label: "全部置于顶层", role: "bringAllToFront" },
			],
		},
	];
}
