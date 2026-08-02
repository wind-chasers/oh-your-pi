import { Terminal } from "lucide-react";
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
			<div className="flex items-center gap-2 px-2 py-1">
				<Terminal aria-hidden className="size-3.5 text-muted-foreground" />
				<p className="text-xs font-medium">运行指令</p>
			</div>
			<ExtensionList
				activeIndex={state.activeIndex}
				empty={(
					<p className="px-2 py-3 text-center text-xs text-muted-foreground" role="status">
						没有匹配“{state.query}”的指令
					</p>
				)}
				getKey={({ name }) => name}
				items={commands}
				onHover={(index) => dispatch({ type: "hover", index })}
				onSelect={({ name }) => dispatch({ type: "select", name })}
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
