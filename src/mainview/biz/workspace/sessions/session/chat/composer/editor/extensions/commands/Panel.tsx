import type { EditorExtensionPanelProps } from "../../framework";
import { ExtensionList } from "../shared/List";
import type { CommandExtensionState, CommandPanelEvent } from "./model";
import { commandSource } from "./source";

export function CommandPanel({
	dispatch,
	state,
}: EditorExtensionPanelProps<CommandExtensionState, CommandPanelEvent>) {
	const commands = commandSource.search(state.query);
	return (
		<div className="flex flex-col gap-1 p-1">
			<div className="flex items-center justify-between gap-2 px-2 py-1">
				<p className="text-xs font-medium">运行指令</p>
				<p className="text-xs text-muted-foreground">↑↓ 选择 · Enter 运行 · Tab 补全</p>
			</div>
			<ExtensionList
				activeIndex={state.activeIndex}
				empty={(
					<p className="px-2 py-3 text-center text-xs text-muted-foreground" role="status">
						没有匹配“{state.query}”的指令
					</p>
				)}
				getKey={({ id }) => id}
				items={commands}
				onHover={(index) => dispatch({ type: "hover", index })}
				onSelect={({ id }) => dispatch({ type: "select", id })}
				renderItem={({ description, name }) => (
					<>
						<span className="font-mono text-primary">/{name}</span>
						<span className="truncate text-xs text-muted-foreground">{description}</span>
					</>
				)}
			/>
		</div>
	);
}
