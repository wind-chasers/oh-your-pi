import { FileCode2 } from "lucide-react";
import type { EditorExtensionPanelProps } from "../../framework";
import { ExtensionList } from "../shared/List";
import type { FileMentionPanelEvent, FileMentionState } from "./model";
import { fileMentionSource } from "./source";

export function FileMentionPanel({
	dispatch,
	state,
}: EditorExtensionPanelProps<FileMentionState, FileMentionPanelEvent>) {
	const files = fileMentionSource.search(state.query);
	return (
		<div className="flex flex-col gap-1 p-1">
			<div className="flex items-center justify-between gap-3 px-2 py-1">
				<p className="text-xs font-medium">引用文件</p>
				<p className="text-xs text-muted-foreground">↑↓ 选择 · Enter/Tab 插入</p>
			</div>
			<ExtensionList
				activeIndex={state.activeIndex}
				empty={(
					<p className="px-2 py-3 text-center text-xs text-muted-foreground" role="status">
						没有匹配“{state.query}”的文件
					</p>
				)}
				getKey={({ path }) => path}
				items={files}
				onHover={(index) => dispatch({ type: "hover", index })}
				onSelect={({ path }) => dispatch({ type: "select", path })}
				renderItem={({ path }) => (
					<>
						<FileCode2 aria-hidden data-icon="inline-start" />
						<span className="truncate font-mono">{path}</span>
					</>
				)}
			/>
		</div>
	);
}
