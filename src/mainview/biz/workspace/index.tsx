import { type ReactElement, useEffect, useState } from "react";
import { SelectedSessionAtom, WorkspaceAtom } from "@view/states/current.atom";
import { WorkspaceAttr } from "./attr";
import { SessionChat, SessionProvider } from "./sessions/session";
import { FilePreview } from "./files/FilePreview";
import { WorkspaceFileExplorer } from "./files/WorkspaceFileExplorer";
import { useWorkspaceFiles } from "./files/use-workspace-files";
import { SessionList } from "./sessions/SessionList";
import { WorkspaceAlerts } from "./WorkspaceAlerts";
import { WorkspacePlaceholder, WorkspaceReady } from "./WorkspaceEmptyState";


function SidePannel(props: {
	fileTreeOpen: boolean;
}) {
	const { fileTreeOpen } = props;
	if (fileTreeOpen) return null;

	return (
		<div className="shrink-0 min-h-0 w-65 flex flex-col border-r bg-muted/20">
			<SessionList />
			<WorkspaceAttr />
		</div>
	);
}

export function WorkspacePage(): ReactElement {
	const snapshot = WorkspaceAtom.useValue();
	const selectedSession = SelectedSessionAtom.useValue();
	const [fileTreeOpen, setFileTreeOpen] = useState(false);
	const files = useWorkspaceFiles(snapshot?.workspacePath);

	useEffect(() => {
		setFileTreeOpen(false);
	}, [snapshot?.workspacePath]);

	function closeFileTree(): void {
		setFileTreeOpen(false);
		files.clearSelection();
	}

	if (!snapshot) return <WorkspacePlaceholder />;

	return (
		<section
			aria-label="当前工作区"
			className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
		>
			<WorkspaceAlerts />
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<SidePannel fileTreeOpen={fileTreeOpen} />
				<div className="min-w-0 flex-1 overflow-hidden">
					{selectedSession?.workspacePath === snapshot.workspacePath ? (
						<SessionProvider key={selectedSession.sessionId}>
							<SessionChat
								isFileTreeOpen={fileTreeOpen}
								key={selectedSession.sessionId}
								onToggleFileTree={() => setFileTreeOpen((value) => !value)}
								sessionId={selectedSession.sessionId}
								sessionPath={selectedSession.sessionPath}
								workspacePath={selectedSession.workspacePath}
							/>
						</SessionProvider>
					) : (
						<WorkspaceReady onOpenFiles={() => setFileTreeOpen(true)} />
					)}
				</div>
				{fileTreeOpen && (
					<>
						<WorkspaceFileExplorer
							onClose={closeFileTree}
							onSelectFile={files.selectFile}
							selectedPath={files.selectedFile?.path}
							selectionError={files.selectionError}
							workspacePath={snapshot.workspacePath}
						/>
						{files.selectedFile && (
							<FilePreview file={files.selectedFile} onClose={files.clearSelection} />
						)}
					</>
				)}
			</div>
		</section>
	);
}

