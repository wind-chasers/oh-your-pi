import { defineEditorExtension } from "../../framework";
import { FileMentionPanel } from "./Panel";
import {
	activateFileMention,
	handleFileMentionCommand,
	handleFileMentionPanelEvent,
	transitionFileMention,
} from "./strategy";

export const fileExtension = defineEditorExtension({
	Panel: FileMentionPanel,
	activate: activateFileMention,
	handleCommand: handleFileMentionCommand,
	handlePanelEvent: handleFileMentionPanelEvent,
	id: "file",
	surface: { align: "start", className: "w-80 p-0", side: "top", sideOffset: 8 },
	transition(state, event, context) {
		return transitionFileMention(state, event, context.draft);
	},
	triggers: ["@"],
});
