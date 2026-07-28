import { BrowserWindow } from "electrobun/bun";
import { HomeWindowStateSaver, loadHomeWindowFrame, type HomeWindowFrame } from "./window-state";

const DEFAULT_HOME_WINDOW_FRAME: HomeWindowFrame = {
	x: 200,
	y: 200,
	width: 1200,
	height: 800,
};

type BrowserWindowOptions = NonNullable<ConstructorParameters<typeof BrowserWindow>[0]>;
type MainWindowRpc = NonNullable<BrowserWindowOptions["rpc"]>;

type WindowMoveEvent = {
	data: { x: number; y: number };
};

type WindowResizeEvent = {
	data: HomeWindowFrame;
};

export function createMainWindow(options: {
	onClose(): void;
	rpc: MainWindowRpc;
	url: string;
}): BrowserWindow {
	let frame = loadHomeWindowFrame() ?? DEFAULT_HOME_WINDOW_FRAME;
	const stateSaver = new HomeWindowStateSaver();
	const window = new BrowserWindow({
		rpc: options.rpc,
		title: "Oh Your Pi",
		url: options.url,
		titleBarStyle: "hiddenInset",
		frame,
	});

	stateSaver.flush(frame);
	window.on("move", (event) => {
		const move = event as WindowMoveEvent;
		frame = { ...frame, x: move.data.x, y: move.data.y };
		stateSaver.schedule(frame);
	});
	window.on("resize", (event) => {
		const resize = event as WindowResizeEvent;
		frame = resize.data;
		stateSaver.schedule(frame);
	});
	window.on("close", () => {
		stateSaver.flush(frame);
		options.onClose();
	});
	return window;
}
