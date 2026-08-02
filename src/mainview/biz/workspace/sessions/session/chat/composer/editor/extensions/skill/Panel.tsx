import { Sparkles } from "lucide-react";
import type { EditorExtensionPanelProps } from "../../framework";
import { ExtensionList } from "../shared/List";
import type { SkillExtensionState, SkillPanelEvent } from "./model";
import { skillSource } from "./source";

export function SkillPanel({
	dispatch,
	state,
}: EditorExtensionPanelProps<SkillExtensionState, SkillPanelEvent>) {
	const skills = skillSource.search(state.query);
	return (
		<div className="flex flex-col gap-1 p-1">
			<div className="px-2 py-1">
				<p className="text-xs font-medium">选择 Skill</p>
				<p className="text-xs text-muted-foreground">输入名称筛选，Enter 或 Tab 插入</p>
			</div>
			<ExtensionList
				activeIndex={state.activeIndex}
				empty={(
					<p className="px-2 py-3 text-center text-xs text-muted-foreground" role="status">
						没有匹配“{state.query}”的 Skill
					</p>
				)}
				getKey={({ name }) => name}
				items={skills}
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
