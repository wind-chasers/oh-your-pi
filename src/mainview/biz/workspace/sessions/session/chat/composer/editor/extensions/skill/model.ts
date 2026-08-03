import type { TokenExtensionState } from "../shared/token";

export interface SkillDefinition {
	description: string;
	name: string;
}

export interface SkillExtensionState extends TokenExtensionState {
	activeIndex: number;
	skills: readonly SkillDefinition[];
}

export type SkillPanelEvent =
	| { type: "results"; query: string; skills: readonly SkillDefinition[] }
	| { type: "hover"; index: number }
	| { type: "select"; name: string };
