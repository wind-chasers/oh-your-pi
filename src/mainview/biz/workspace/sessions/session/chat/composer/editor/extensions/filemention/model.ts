import type { TokenExtensionState } from "../shared/token";

export interface WorkspaceFile {
	isDirectory: boolean;
	path: string;
}

export type FileSearchStatus = "degraded" | "error" | "loading" | "ready";

export interface FileMentionState extends TokenExtensionState {
	activeIndex: number;
	files: readonly WorkspaceFile[];
	status: FileSearchStatus;
}

export type FileMentionPanelEvent =
	| { type: "hover"; index: number }
	| { type: "search"; files: readonly WorkspaceFile[]; query: string; status: FileSearchStatus }
	| { type: "select"; path: string };
