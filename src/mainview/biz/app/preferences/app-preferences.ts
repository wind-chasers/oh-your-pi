const SHOW_THINKING_KEY = "oh-your-pi.show-thinking";

export function readShowThinking(): boolean {
	try {
		return window.localStorage.getItem(SHOW_THINKING_KEY) === "true";
	} catch {
		return false;
	}
}

export function saveShowThinking(value: boolean): void {
	try {
		window.localStorage.setItem(SHOW_THINKING_KEY, String(value));
	} catch {
		return;
	}
}
