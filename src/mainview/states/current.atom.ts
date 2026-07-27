import type { PiOpenedSession, PiWorkspaceSnapshot } from "@shared/pi-contract";
import { atom } from "@view/atom";

export const WorkspaceAtom = atom<PiWorkspaceSnapshot | undefined>(undefined);
export const OpenedSessionAtom = atom<PiOpenedSession | undefined>(undefined);
