import {
	ChevronDown,
	ChevronRight,
	File,
	Folder,
	FolderOpen,
	X,
} from "lucide-react";
import { type ReactElement, useCallback, useEffect, useState } from "react";
import type { PiWorkspaceFile } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import { listPiWorkspaceFiles } from "@view/lib/pi-client";

type WorkspaceFileExplorerProps = {
	onClose: () => void;
	onSelectFile: (path: string) => Promise<void>;
	selectedPath?: string;
	selectionError?: string;
	workspacePath: string;
};

export function WorkspaceFileExplorer({
	onClose,
	onSelectFile,
	selectedPath,
	selectionError,
	workspacePath,
}: WorkspaceFileExplorerProps): ReactElement {
	const [entries, setEntries] = useState<Record<string, PiWorkspaceFile[]>>({});
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string>();
	const loadDirectory = useCallback(
		async (path = "") => {
			if (entries[path]) return;
			setLoading((current) => new Set(current).add(path));
			try {
				const directoryEntries = await listPiWorkspaceFiles({
					relativePath: path || undefined,
					workspacePath,
				});
				setEntries((current) => ({ ...current, [path]: directoryEntries }));
			} catch (requestError) {
				setError(
					requestError instanceof Error
						? requestError.message
						: "无法读取文件树。",
				);
			} finally {
				setLoading((current) => {
					const next = new Set(current);
					next.delete(path);
					return next;
				});
			}
		},
		[entries, workspacePath],
	);
	useEffect(() => {
		void loadDirectory();
	}, [loadDirectory]);
	function toggleDirectory(path: string): void {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
		void loadDirectory(path);
	}
	return (
		<aside
			aria-label="文件树"
			className="shrink-0 h-full w-65 overflow-y-auto border-l bg-muted/20"
		>
			<header className="flex items-center justify-between gap-2 border-b px-3 h-10">
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">文件</p>
				</div>
				<Button
					aria-label="关闭文件树"
					onClick={onClose}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<X aria-hidden />
				</Button>
			</header>
			<div className="px-3 pt-2 truncate text-xs text-muted-foreground" title={workspacePath}>
				{workspacePath}
			</div>
			{selectionError ? (
				<p className="px-3 pt-3 text-xs text-destructive" role="alert">
					{selectionError}
				</p>
			) : null}
			{error ? (
				<p className="px-3 pt-3 text-xs text-destructive" role="alert">
					{error}
				</p>
			) : null}
			<div className="p-2">
				{loading.has("") && !entries[""] ? (
					<p className="px-2 py-3 text-xs text-muted-foreground">
						正在读取文件…
					</p>
				) : (
					<FileNodes
						entries={entries}
						expanded={expanded}
						loading={loading}
						onSelectFile={onSelectFile}
						onToggleDirectory={toggleDirectory}
						parentPath=""
						selectedPath={selectedPath}
					/>
				)}
			</div>
		</aside>
	);
}

type FileNodesProps = {
	entries: Record<string, PiWorkspaceFile[]>;
	expanded: Set<string>;
	loading: Set<string>;
	onSelectFile: (path: string) => Promise<void>;
	onToggleDirectory: (path: string) => void;
	parentPath: string;
	selectedPath?: string;
};

function FileNodes({
	entries,
	expanded,
	loading,
	onSelectFile,
	onToggleDirectory,
	parentPath,
	selectedPath,
}: FileNodesProps): ReactElement {
	return (
		<ul className="flex flex-col gap-0.5">
			{(entries[parentPath] ?? []).map((entry) => (
				<FileNode
					entry={entry}
					entries={entries}
					expanded={expanded}
					key={entry.path}
					loading={loading}
					onSelectFile={onSelectFile}
					onToggleDirectory={onToggleDirectory}
					selectedPath={selectedPath}
				/>
			))}
		</ul>
	);
}

function FileNode({
	entry,
	entries,
	expanded,
	loading,
	onSelectFile,
	onToggleDirectory,
	selectedPath,
}: Omit<FileNodesProps, "parentPath"> & {
	entry: PiWorkspaceFile;
}): ReactElement {
	const isDirectory = entry.type === "directory";
	const isExpanded = expanded.has(entry.path);
	const icon = isDirectory ? (
		isExpanded ? (
			<FolderOpen aria-hidden className="size-3.5 text-muted-foreground" />
		) : (
			<Folder aria-hidden className="size-3.5 text-muted-foreground" />
		)
	) : (
		<File aria-hidden className="size-3.5 text-muted-foreground" />
	);
	return (
		<li>
			<button
				aria-current={selectedPath === entry.path ? "page" : undefined}
				aria-expanded={isDirectory ? isExpanded : undefined}
				className="flex h-7 w-full items-center gap-1 rounded px-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 aria-[current=page]:bg-primary/10"
				onClick={() =>
					isDirectory
						? onToggleDirectory(entry.path)
						: void onSelectFile(entry.path)
				}
				type="button"
			>
				{isDirectory ? (
					isExpanded ? (
						<ChevronDown aria-hidden className="size-3" />
					) : (
						<ChevronRight aria-hidden className="size-3" />
					)
				) : (
					<span className="w-3" />
				)}
				{icon}
				<span className="truncate">{entry.name}</span>
			</button>
			{isDirectory && isExpanded ? (
				<div className="ml-3 border-l pl-2">
					{loading.has(entry.path) ? (
						<p className="px-1 py-1 text-xs text-muted-foreground">读取中…</p>
					) : (
						<FileNodes
							entries={entries}
							expanded={expanded}
							loading={loading}
							onSelectFile={onSelectFile}
							onToggleDirectory={onToggleDirectory}
							parentPath={entry.path}
							selectedPath={selectedPath}
						/>
					)}
				</div>
			) : null}
		</li>
	);
}
