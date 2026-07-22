import { type ReactElement, useEffect, useState } from "react";
import type { PiAuthenticationStatus, PiOpenedSession, PiWorkspaceSnapshot } from "@shared/pi-contract";

import { SessionChat } from "./sessions/session";
import { FilePreview } from "./files/FilePreview";
import { WorkspaceFileExplorer } from "./files/WorkspaceFileExplorer";
import { useWorkspaceFiles } from "./files/use-workspace-files";
import { SessionList } from "./sessions/SessionList";
import { WorkspaceAlerts } from "./WorkspaceAlerts";
import { WorkspacePlaceholder, WorkspaceReady } from "./WorkspaceEmptyState";

type WorkspacePageProps = {
	authentication: PiAuthenticationStatus[];
	disabled: boolean;
	error?: string;
	isNetworkOnline: boolean;
	onContinueRecentSession: () => Promise<void>;
	onCreateSession: () => Promise<void>;
	onOpenAuthentication: () => void;
	onRefreshSession: () => Promise<void>;
	onSelectSession: (sessionPath: string) => Promise<void>;
	onSessionUpdate: (session: PiOpenedSession) => void;
	onStreamingChange: (isStreaming: boolean) => void;
	openedSession?: PiOpenedSession;
	selectedSessionPath?: string;
	showThinking: boolean;
	snapshot?: PiWorkspaceSnapshot;
};

export function WorkspacePage({
	authentication,
	disabled,
	error,
	isNetworkOnline,
	onContinueRecentSession,
	onCreateSession,
	onOpenAuthentication,
	onRefreshSession,
	onSelectSession,
	onSessionUpdate,
	onStreamingChange,
	openedSession,
	selectedSessionPath,
	showThinking,
	snapshot,
}: WorkspacePageProps): ReactElement {
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

	const showSessionList = !fileTreeOpen || files.selectedFile !== undefined;
	return (
		<section
			aria-label="当前工作区"
			className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
		>
			<WorkspaceAlerts error={error} isNetworkOnline={isNetworkOnline} />
			<div className="flex min-h-0 flex-1 overflow-hidden">
				{showSessionList ? (
					<SessionList
						disabled={disabled}
						onContinueRecentSession={onContinueRecentSession}
						onCreateSession={onCreateSession}
						onSelectSession={onSelectSession}
						selectedSessionPath={selectedSessionPath}
						sessions={snapshot.sessions}
					/>
				) : null}
				<div className="min-w-0 flex-1 overflow-hidden">
					{openedSession ? (
						<SessionChat
							authentication={authentication}
							isFileTreeOpen={fileTreeOpen}
							onOpenAuthentication={onOpenAuthentication}
							onRefresh={onRefreshSession}
							onStreamingChange={onStreamingChange}
							onToggleFileTree={() => setFileTreeOpen((value) => !value)}
							openedSession={openedSession}
							onSessionUpdate={onSessionUpdate}
							showThinking={showThinking}
						/>
					) : (
						<WorkspaceReady onCreateSession={onCreateSession} onOpenFiles={() => setFileTreeOpen(true)} />
					)}
				</div>
				{fileTreeOpen ? (
					<WorkspaceFileExplorer
						onClose={closeFileTree}
						onSelectFile={files.selectFile}
						selectedPath={files.selectedFile?.path}
						selectionError={files.selectionError}
						workspacePath={snapshot.workspacePath}
					/>
				) : null}
				{fileTreeOpen && files.selectedFile ? (
					<FilePreview file={files.selectedFile} onClose={files.clearSelection} />
				) : null}
			</div>
		</section>
	);
}

