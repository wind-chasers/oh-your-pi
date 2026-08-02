import { atom } from "@view/atom";

const RECENT_WORKSPACES_KEY = "oh-your-pi.recent-workspaces";
const SHOW_THINKING_KEY = "oh-your-pi.show-thinking";
const MAX_RECENT_WORKSPACES = 5;

export const ShowThinkingAtom = atom(false, ({ get, set }) => {
	set(readShowThinking());

	function change(value: boolean): void {
		if (value === get()) return;
		saveShowThinking(value);
		set(value);
	}

	return { change };
});

export const RecentWorkspacesAtom = atom([] as string[], ({ get, set }) => {
	set(readRecentWorkspaces());

	function add(workspacePath: string): void {
		const next = updateRecentWorkspaces(get(), workspacePath);
		set(next);
		try {
			window.localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(next));
		} catch {
			return;
		}
	}

	return { add };
});

function readRecentWorkspaces(): string[] {
	try {
		const stored = window.localStorage.getItem(RECENT_WORKSPACES_KEY);
		if (!stored) return [];
		const parsed: unknown = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(path): path is string => typeof path === "string" && path.length > 0,
			)
			.slice(0, MAX_RECENT_WORKSPACES);
	} catch {
		return [];
	}
}

function readShowThinking(): boolean {
	try {
		return window.localStorage.getItem(SHOW_THINKING_KEY) === "true";
	} catch {
		return false;
	}
}

function saveShowThinking(value: boolean): void {
	try {
		window.localStorage.setItem(SHOW_THINKING_KEY, String(value));
	} catch {
		return;
	}
}

export function updateRecentWorkspaces(
	workspaces: string[],
	workspacePath: string,
): string[] {
	const uniqueWorkspaces = [...new Set(workspaces)];
	if (uniqueWorkspaces.includes(workspacePath)) return uniqueWorkspaces;
	return [...uniqueWorkspaces, workspacePath].slice(-MAX_RECENT_WORKSPACES);
}
