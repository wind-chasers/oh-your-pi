import Electrobun, { BrowserWindow, Updater } from "electrobun/bun";
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { PiWorkspaceService } from "@main/workspace/service";
import { createPiRpc } from "@main/rpc/pi-rpc";
import { HomeWindowStateSaver, loadHomeWindowFrame, type HomeWindowFrame } from "@main/window-state";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const DEV_SERVER_STARTUP_ATTEMPTS = 30;
const DEV_SERVER_RETRY_DELAY_MS = 100;
const DEFAULT_HOME_WINDOW_FRAME: HomeWindowFrame = {
	x: 200,
	y: 200,
	width: 1200,
	height: 800,
};

// Electrobun bundles the Bun main process. Pi's OAuth implementations use a
// bundler-opaque import, so register the static Bun loaders before any runtime.
registerBunOAuthFlows();

async function waitForDevServer(): Promise<boolean> {
	for (let attempt = 0; attempt < DEV_SERVER_STARTUP_ATTEMPTS; attempt += 1) {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			return true;
		} catch {
			if (attempt < DEV_SERVER_STARTUP_ATTEMPTS - 1) await Bun.sleep(DEV_SERVER_RETRY_DELAY_MS);
		}
	}
	return false;
}

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		if (await waitForDevServer()) {
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		}
		console.log("Vite dev server unavailable. Falling back to the bundled main view.");
	}
	return "views://mainview/index.html";
}

// Create the main application window
const url = await getMainViewUrl();
const workspaceService = new PiWorkspaceService();
const piRpc = createPiRpc(workspaceService);

let mainWindow: BrowserWindow | undefined;
type WindowMoveEvent = {
	data: {
		x: number;
		y: number;
	};
};

type WindowResizeEvent = {
	data: HomeWindowFrame;
};

function createHomeWindow(): BrowserWindow {
	let homeWindowFrame = loadHomeWindowFrame() ?? DEFAULT_HOME_WINDOW_FRAME;
	const stateSaver = new HomeWindowStateSaver();
	const homeWindow = new BrowserWindow({
		rpc: piRpc,
		title: "Oh Your Pi",
		url,
		titleBarStyle: "hiddenInset",
		frame: homeWindowFrame,
	});

	stateSaver.flush(homeWindowFrame);
	homeWindow.on("move", (event) => {
		const moveEvent = event as WindowMoveEvent;
		homeWindowFrame = { ...homeWindowFrame, x: moveEvent.data.x, y: moveEvent.data.y };
		stateSaver.schedule(homeWindowFrame);
	});
	homeWindow.on("resize", (event) => {
		const resizeEvent = event as WindowResizeEvent;
		homeWindowFrame = resizeEvent.data;
		stateSaver.schedule(homeWindowFrame);
	});
	homeWindow.on("close", () => {
		stateSaver.flush(homeWindowFrame);
		if (homeWindow === mainWindow) mainWindow = undefined;
	});

	return homeWindow;
}

mainWindow = createHomeWindow();

if (process.platform === "darwin") {
	Electrobun.events.on("reopen", () => {
		if (!mainWindow) mainWindow = createHomeWindow();
	});
}

console.log("Oh Your Pi started!");
