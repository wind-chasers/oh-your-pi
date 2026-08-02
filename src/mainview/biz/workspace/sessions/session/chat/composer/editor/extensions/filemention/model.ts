import type { TokenExtensionState } from "../shared/token";

export interface WorkspaceFile {
	path: string;
}

export interface FileMentionState extends TokenExtensionState {
	activeIndex: number;
}

export type FileMentionPanelEvent =
	| { type: "hover"; index: number }
	| { type: "select"; path: string };
