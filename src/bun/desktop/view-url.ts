import { Updater } from "electrobun/bun";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const DEV_SERVER_STARTUP_ATTEMPTS = 30;
const DEV_SERVER_RETRY_DELAY_MS = 100;

export async function resolveMainViewUrl(): Promise<string> {
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
