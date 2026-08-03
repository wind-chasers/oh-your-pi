import { useEffect, useRef } from "react";
import { FileCode2, Loader2 } from "lucide-react";
import { WorkspaceAtom } from "@view/states/current.atom";
import type { EditorExtensionPanelProps } from "../../framework";
import { ExtensionList } from "../shared/List";
import type { FileMentionPanelEvent, FileMentionState } from "./model";
import { searchWorkspaceFiles } from "./source";

const SEARCH_DEBOUNCE_MS = 60;

export function FileMentionPanel({
	dispatch,
	state,
}: EditorExtensionPanelProps<FileMentionState, FileMentionPanelEvent>) {
	const workspacePath = WorkspaceAtom.useValue()?.workspacePath;
	const requestId = useRef(0);

	useEffect(() => {
		const id = ++requestId.current;
		if (!workspacePath) return;
		const timeout = setTimeout(async () => {
			try {
				const result = await searchWorkspaceFiles({ query: state.query, workspacePath });
				if (requestId.current === id) {
					dispatch({
						type: "search",
						files: result.files,
						query: state.query,
						status: result.degraded ? "degraded" : "ready",
					});
				}
			} catch {
				if (requestId.current === id) {
					dispatch({ type: "search", files: [], query: state.query, status: "error" });
				}
			}
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [dispatch, state.query, workspacePath]);

	const degraded = state.status === "degraded";
	const ready = state.status === "ready" || degraded;

	return (
		<div className="flex flex-col gap-1 p-1">
			<div className="flex items-center justify-between gap-3 px-2 py-1">
				<p className="text-xs font-medium">引用文件</p>
				<p className="text-xs text-muted-foreground">↑↓ 选择 · Enter/Tab 插入</p>
			</div>
			{!workspacePath ? (
				<p className="px-2 py-3 text-center text-xs text-muted-foreground" role="status">
					未选择工作区。
				</p>
			) : state.status === "loading" ? (
				<div className="flex items-center gap-2 px-2 py-3">
					<Loader2 aria-hidden className="size-3.5 animate-spin text-muted-foreground" />
					<p className="text-xs text-muted-foreground" role="status">正在搜索文件…</p>
				</div>
			) : state.status === "error" ? (
				<p className="px-2 py-3 text-center text-xs text-muted-foreground" role="status">
					搜索失败，请重试。
				</p>
			) : ready ? (
				<>
					{degraded ? (
						<p className="px-2 pt-1 text-xs text-muted-foreground" role="status">
							全局搜索不可用，仅匹配当前目录。
						</p>
					) : null}
					<ExtensionList
						activeIndex={state.activeIndex}
						empty={(
							<p className="px-2 py-3 text-center text-xs text-muted-foreground" role="status">
								没有匹配“{state.query}”的文件
							</p>
						)}
						getKey={({ path }) => path}
						items={state.files}
						onHover={(index) => dispatch({ type: "hover", index })}
						onSelect={({ path }) => dispatch({ type: "select", path })}
						renderItem={({ isDirectory, path }) => (
							<>
								<FileCode2 aria-hidden data-icon="inline-start" />
								<span className="truncate font-mono">{path}{isDirectory ? "/" : ""}</span>
							</>
						)}
					/>
				</>
			) : null}
		</div>
	);
}
