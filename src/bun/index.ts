import Electrobun, { BrowserWindow, Utils } from "electrobun/bun";
import { Application } from "@main/app";
import { createMainWindow } from "@main/desktop/main-window";
import { createDesktopSystem } from "@main/desktop/system";
import { resolveMainViewUrl } from "@main/desktop/view-url";
import { assertPiRuntimeCapabilities, PiRuntime, registerPiOAuthFlows } from "@main/pi";
import { createPiRpc } from "@main/rpc";

assertPiRuntimeCapabilities();

registerPiOAuthFlows();

const pi = await PiRuntime.create();
const app = new Application(pi);
const desktop = createDesktopSystem();
const rpcBinding = createPiRpc({ app, desktop });
const url = await resolveMainViewUrl();

let mainWindow: BrowserWindow | undefined;
let disposing = false;
let disposed = false;

function openMainWindow(): void {
	let window: BrowserWindow;
	window = createMainWindow({
		rpc: rpcBinding.rpc,
		url,
		onClose() {
			if (mainWindow === window) mainWindow = undefined;
		},
	});
	mainWindow = window;
}

async function disposeApplication(): Promise<void> {
	rpcBinding.dispose();
	try {
		await app.dispose();
	} finally {
		await pi.dispose();
	}
}

openMainWindow();

if (process.platform === "darwin") {
	Electrobun.events.on("reopen", () => {
		if (!mainWindow) openMainWindow();
	});
}

Electrobun.events.on("before-quit", (event) => {
	if (disposed) return;
	event.response = { allow: false };
	if (disposing) return;
	disposing = true;
	void disposeApplication()
		.catch((error) => console.error("关闭主进程资源失败。", error))
		.finally(() => {
			disposed = true;
			Utils.quit();
		});
});

console.log("Oh Your Pi started!");
