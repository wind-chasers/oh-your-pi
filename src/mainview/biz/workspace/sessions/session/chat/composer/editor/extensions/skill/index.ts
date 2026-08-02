import { defineEditorExtension } from "../../framework";
import { SkillPanel } from "./Panel";
import {
	activateSkill,
	handleSkillCommand,
	handleSkillPanelEvent,
	transitionSkill,
} from "./strategy";

export const skillExtension = defineEditorExtension({
	Panel: SkillPanel,
	activate: activateSkill,
	handleCommand: handleSkillCommand,
	handlePanelEvent: handleSkillPanelEvent,
	id: "skill",
	surface: { align: "start", className: "w-96 p-0", side: "top", sideOffset: 8 },
	transition(state, event, context) {
		return transitionSkill(state, event, context.draft);
	},
	triggers: ["#"],
});
