const DARK_MODE_KEY = "oh-your-pi.dark-mode";

export function applySavedDarkMode(): boolean {
	const isDarkMode = readDarkMode();
	applyDarkMode(isDarkMode);
	return isDarkMode;
}

export function readDarkMode(): boolean {
	try {
		return window.localStorage.getItem(DARK_MODE_KEY) === "true";
	} catch {
		return false;
	}
}

export function setDarkMode(isDarkMode: boolean): void {
	applyDarkMode(isDarkMode);
	try {
		window.localStorage.setItem(DARK_MODE_KEY, String(isDarkMode));
	} catch {
		return;
	}
}

function applyDarkMode(isDarkMode: boolean): void {
	document.documentElement.classList.toggle("dark", isDarkMode);
}
