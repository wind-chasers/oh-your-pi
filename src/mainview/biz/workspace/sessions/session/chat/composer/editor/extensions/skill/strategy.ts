import type {
	EditorCommand,
	EditorExtensionEvent,
	EditorExtensionResult,
	EditorExtensionTransition,
	EditorTriggerContext,
} from "../../framework";
import {
	createTokenState,
	moveActiveIndex,
	transitionTokenState,
} from "../shared/token";
import type { SkillDefinition, SkillExtensionState, SkillPanelEvent } from "./model";

const SKILL_BREAK_CHARACTERS = new Set([
	"/", ",", "，", ";", "；", "!", "！", "?", "？", "。", ".",
	"\"", "'", "“", "”", "‘", "’", "`", "(", ")", "（", "）",
	"[", "]", "{", "}", "<", ">", "|", "&", "=", "#", "@",
]);

function isSkillBreakCharacter(character: string): boolean {
	return /\s/u.test(character) || SKILL_BREAK_CHARACTERS.has(character);
}

function acceptSkill(
	state: SkillExtensionState,
	skill: SkillDefinition,
): EditorExtensionResult<SkillExtensionState> {
	const insert = `[#skill:${skill.name}]`;
	return {
		type: "transaction",
		transaction: {
			close: true,
			edit: {
				cursor: state.triggerIndex + insert.length,
				from: state.triggerIndex,
				insert,
				to: state.tokenEnd,
			},
		},
	};
}

export function activateSkill(context: EditorTriggerContext): SkillExtensionState | null {
	const token = createTokenState(context, "#");
	return token ? { ...token, activeIndex: 0, skills: [] } : null;
}

export function transitionSkill(
	state: SkillExtensionState,
	event: EditorExtensionEvent,
	draft: string,
): EditorExtensionTransition<SkillExtensionState> {
	const transition = transitionTokenState(state, event, draft, isSkillBreakCharacter);
	if (transition.type === "close") return transition;
	const nextState = transition.state.query === state.query
		? transition.state
		: { ...transition.state, activeIndex: 0, skills: [] };
	return { type: "update", state: nextState };
}

export function handleSkillCommand(
	state: SkillExtensionState,
	command: EditorCommand,
): EditorExtensionResult<SkillExtensionState> {
	if (command.type === "cancel") return { type: "close" };
	const skills = state.skills;
	if (command.type === "navigate") {
		const activeIndex = moveActiveIndex(state.activeIndex, skills.length, command.direction);
		return activeIndex === null
			? { type: "ignore" }
			: { type: "update", state: { ...state, activeIndex } };
	}
	const skill = skills[state.activeIndex];
	return skill ? acceptSkill(state, skill) : { type: "ignore" };
}

export function handleSkillPanelEvent(
	state: SkillExtensionState,
	event: SkillPanelEvent,
): EditorExtensionResult<SkillExtensionState> {
	const skills = state.skills;
	if (event.type === "results") {
		if (event.query !== state.query) return { type: "ignore" };
		return { type: "update", state: { ...state, activeIndex: 0, skills: event.skills } };
	}
	if (event.type === "hover") {
		if (event.index < 0 || event.index >= skills.length) return { type: "ignore" };
		return { type: "update", state: { ...state, activeIndex: event.index } };
	}
	const skill = skills.find(({ name }) => name === event.name);
	return skill ? acceptSkill(state, skill) : { type: "ignore" };
}

