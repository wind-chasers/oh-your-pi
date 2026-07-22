import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";

const WINDOW_STATE_FILE_NAME = "window.json";
const WINDOW_STATE_WRITE_DELAY_MS = 150;

export type HomeWindowFrame = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type StoredHomeWindowFrame = {
	x: number;
	y: number;
	w: number;
	h: number;
};

type WindowState = {
	home: StoredHomeWindowFrame;
};

export function getOhYourPiDataDir(): string {
	return join(homedir(), CONFIG_DIR_NAME, "oh-your-pi");
}

export function getWindowStatePath(): string {
	return join(getOhYourPiDataDir(), WINDOW_STATE_FILE_NAME);
}

export function loadHomeWindowFrame(): HomeWindowFrame | undefined {
	try {
		return parseHomeWindowFrame(JSON.parse(readFileSync(getWindowStatePath(), "utf8")));
	} catch {
		return undefined;
	}
}

export function saveHomeWindowFrame(frame: HomeWindowFrame): void {
	const statePath = getWindowStatePath();
	const dataDirectory = getOhYourPiDataDir();
	const temporaryPath = `${statePath}.${process.pid}.tmp`;
	const state: WindowState = {
		home: {
			x: frame.x,
			y: frame.y,
			w: frame.width,
			h: frame.height,
		},
	};

	try {
		mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
		writeFileSync(temporaryPath, `${JSON.stringify(state, null, "\t")}\n`, { mode: 0o600 });
		renameSync(temporaryPath, statePath);
	} catch (error) {
		console.error("保存窗口状态失败。", error);
	}
}

export class HomeWindowStateSaver {
	private frame: HomeWindowFrame | undefined;
	private writeTimer: ReturnType<typeof setTimeout> | undefined;

	schedule(frame: HomeWindowFrame): void {
		this.frame = frame;
		if (this.writeTimer) return;

		this.writeTimer = setTimeout(() => {
			this.writeTimer = undefined;
			this.write();
		}, WINDOW_STATE_WRITE_DELAY_MS);
	}

	flush(frame: HomeWindowFrame): void {
		this.frame = frame;
		if (this.writeTimer) clearTimeout(this.writeTimer);
		this.writeTimer = undefined;
		this.write();
	}

	private write(): void {
		if (this.frame) saveHomeWindowFrame(this.frame);
	}
}

function parseHomeWindowFrame(value: unknown): HomeWindowFrame | undefined {
	if (!isRecord(value) || !isRecord(value.home)) return;

	const { x, y, w, h } = value.home;
	if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isPositiveNumber(w) || !isPositiveNumber(h)) return;

	return { x, y, width: w, height: h };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
	return isFiniteNumber(value) && value > 0;
}
