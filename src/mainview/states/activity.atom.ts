import { atom } from "@view/atom";

export const WorkspaceBusyAtom = atom(false);
export const AuthenticationBusyAtom = atom(false);
export const WorkspaceErrorAtom = atom<string | undefined>(undefined);

export const AppDisabledAtom = atom(
	(use) => use(WorkspaceBusyAtom) || use(AuthenticationBusyAtom),
);
