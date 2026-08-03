import { useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { WorkspaceAtom } from "@view/states/current.atom";
import type { EditorExtensionPanelProps } from "../../framework";
import { ExtensionList } from "../shared/List";
import type { SkillDefinition, SkillExtensionState, SkillPanelEvent } from "./model";
import { filterSkills } from "./source";

const EMPTY_SKILLS: readonly SkillDefinition[] = [];

export function SkillPanel({
	dispatch,
	state,
}: EditorExtensionPanelProps<SkillExtensionState, SkillPanelEvent>) {
	const workspaceSkills = WorkspaceAtom.useValue()?.resources.skillDetails ?? EMPTY_SKILLS;
	const skills = useMemo(
		() => filterSkills(workspaceSkills, state.query),
		[state.query, workspaceSkills],
	);

	useEffect(() => {
		dispatch({ type: "results", query: state.query, skills });
	}, [dispatch, skills, state.query]);

	return (
		<div className="flex flex-col gap-1 p-1">
			<div className="flex items-center justify-between gap-3 px-2 py-1">
				<p className="text-xs font-medium">选择 Skill</p>
				<p className="text-xs text-muted-foreground">↑↓ 选择 · Enter/Tab 插入</p>
			</div>
			<ExtensionList
				activeIndex={state.activeIndex}
				empty={(
					<p className="px-2 py-3 text-center text-xs text-muted-foreground" role="status">
						没有匹配“{state.query}”的 Skill
					</p>
				)}
				getKey={({ name }) => name}
				items={state.skills}
				onHover={(index) => dispatch({ type: "hover", index })}
				onSelect={({ name }) => dispatch({ type: "select", name })}
				renderItem={({ description, name }) => (
					<>
						<Sparkles aria-hidden data-icon="inline-start" />
						<span className="min-w-0 text-left">
							<span className="block truncate font-medium">{name}</span>
							<span className="block truncate text-xs text-muted-foreground">{description}</span>
						</span>
					</>
				)}
			/>
		</div>
	);
}
