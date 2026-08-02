import { defineEditorExtension } from "../../framework";
import { CommandPanel } from "./Panel";
import {
	activateCommand,
	handleCommandCommand,
	handleCommandPanelEvent,
	transitionCommand,
} from "./strategy";

export const commandExtension = defineEditorExtension({
	Panel: CommandPanel,
	activate: activateCommand,
	handleCommand: handleCommandCommand,
	handlePanelEvent: handleCommandPanelEvent,
	id: "command",
	surface: { align: "start", className: "w-80 p-0", side: "top", sideOffset: 8 },
	transition(state, event, context) {
		return transitionCommand(state, event, context.draft);
	},
	triggers: ["/"],
});
