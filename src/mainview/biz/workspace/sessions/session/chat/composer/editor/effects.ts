import { useCallback } from "react";
import {
	AuthenticationDialogOpenAtom,
} from "@view/states/authentication.atom";
import { AppSettingsDialogOpenAtom } from "@view/states/preferences.atom";
import {
	CompactSessionMutation,
	CreateSessionMutation,
	SessionCommandDialogAtom,
} from "@view/states/session";
import { isCommandEditorEffect } from "./extensions/commands/model";
import type { EditorEffect } from "./framework";

export function useEditorEffectHandler(): (effect: EditorEffect) => void {
	const createSession = CreateSessionMutation.use();
	const compactSession = CompactSessionMutation.use();
	const setAuthenticationOpen = AuthenticationDialogOpenAtom.useSet();
	const setSessionCommandDialog = SessionCommandDialogAtom.useSet();
	const setSettingsOpen = AppSettingsDialogOpenAtom.useSet();

	return useCallback((effect: EditorEffect) => {
		if (!isCommandEditorEffect(effect)) return;
		switch (effect.command) {
			case "new":
				void createSession();
				return;
			case "fork":
			case "drop":
				setSessionCommandDialog(effect.command);
				return;
			case "compact":
				void compactSession();
				return;
			case "settings":
				setSettingsOpen(true);
				return;
			case "login":
			case "logout":
				setAuthenticationOpen(true);
				return;
		}
	}, [
		compactSession,
		createSession,
		setAuthenticationOpen,
		setSessionCommandDialog,
		setSettingsOpen,
	]);
}
