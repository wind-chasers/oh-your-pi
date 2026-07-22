import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applySavedDarkMode, setDarkMode } from "./theme";

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
let classes: Set<string>;
let storage: Map<string, string>;

beforeEach(() => {
	classes = new Set();
	storage = new Map();
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		},
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { localStorage },
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			documentElement: {
			classList: {
				toggle: (token: string, force?: boolean) => {
					if (force) classes.add(token);
					else classes.delete(token);
					return force ?? false;
				},
			},
		},
		},
	});
});

afterEach(() => {
	restoreGlobal("localStorage", originalLocalStorage);
	restoreGlobal("window", originalWindow);
	restoreGlobal("document", originalDocument);
});

describe("theme preferences", () => {
	test("applies the saved dark-mode preference before rendering", () => {
		storage.set("oh-your-pi.dark-mode", "true");

		expect(applySavedDarkMode()).toBe(true);
		expect(classes.has("dark")).toBe(true);
	});

	test("persists a change and removes the dark class in light mode", () => {
		setDarkMode(true);
		setDarkMode(false);

		expect(storage.get("oh-your-pi.dark-mode")).toBe("false");
		expect(classes.has("dark")).toBe(false);
	});
});

function restoreGlobal(name: "localStorage" | "document" | "window", descriptor: PropertyDescriptor | undefined): void {
	if (descriptor) Object.defineProperty(globalThis, name, descriptor);
	else Reflect.deleteProperty(globalThis, name);
}
