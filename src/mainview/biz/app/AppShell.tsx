import { type ReactElement, useState } from "react";
import { ProviderAuthenticationDialog } from "../authentication/ProviderAuthenticationDialog";
import { WorkspacePage } from "../workspace";
import { AppSidebar } from "./sidebar/AppSidebar";
import { useWorkspaceSessionController } from "./use-workspace-session-controller";

export function AppShell(): ReactElement {
	const controller = useWorkspaceSessionController();
	const [isAuthenticationOpen, setAuthenticationOpen] = useState(false);
	return (
		<div className="flex min-h-0 flex-1 overflow-hidden bg-background">
			<AppSidebar
				authentication={controller.authentication}
				disabled={controller.disabled}
				isDarkMode={controller.isDarkMode}
				isNetworkOnline={controller.isNetworkOnline}
				onChooseWorkspace={controller.onChooseWorkspace}
				onDarkModeChange={controller.onDarkModeChange}
				onOpenAuthentication={() => setAuthenticationOpen(true)}
				onSelectWorkspace={controller.onSelectWorkspace}
				onShowThinkingChange={controller.onShowThinkingChange}
				recentWorkspaces={controller.recentWorkspaces}
				selectedWorkspacePath={controller.snapshot?.workspacePath}
				showThinking={controller.showThinking}
			/>
			<WorkspacePage
				authentication={controller.authentication ?? []}
				disabled={controller.disabled}
				error={controller.error}
				isNetworkOnline={controller.isNetworkOnline}
				onContinueRecentSession={controller.onContinueRecentSession}
				onCreateSession={controller.onCreateSession}
				onOpenAuthentication={() => setAuthenticationOpen(true)}
				onRefreshSession={controller.onRefreshSession}
				onSelectSession={controller.onSelectSession}
				onSessionUpdate={controller.onSessionUpdate}
				onStreamingChange={controller.onStreamingChange}
				openedSession={controller.openedSession}
				selectedSessionPath={controller.openedSession?.runtime.sessionPath}
				showThinking={controller.showThinking}
				snapshot={controller.snapshot}
			/>
			<ProviderAuthenticationDialog
				authentication={controller.authentication}
				onCancel={controller.onCancelProviderLogin}
				onLogin={controller.onLoginProvider}
				onOpenChange={setAuthenticationOpen}
				open={isAuthenticationOpen}
			/>
		</div>
	);
}
