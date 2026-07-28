import type { PiWorkspaceSnapshot } from "@shared/pi-contract";
import { atom } from "@view/atom";

export type SelectedChatSession = {
	workspacePath: string;
	sessionId: string;
	sessionPath: string;
};

export const WorkspaceAtom = atom<PiWorkspaceSnapshot | undefined>(undefined);
export const SelectedSessionAtom = atom<SelectedChatSession | undefined>(undefined);
