import type { TokenExtensionState } from "../shared/token";

export interface SkillDefinition {
	description: string;
	name: string;
}

export interface SkillExtensionState extends TokenExtensionState {
	activeIndex: number;
}

export type SkillPanelEvent =
	| { type: "hover"; index: number }
	| { type: "select"; name: string };
