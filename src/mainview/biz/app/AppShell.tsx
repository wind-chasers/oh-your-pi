import type { ReactElement } from "react";
import { ProviderAuthenticationDialog } from "../authentication/ProviderAuthenticationDialog";
import { WorkspacePage } from "../workspace";
import { AppSidebar } from "./sidebar/AppSidebar";

export function AppShell(): ReactElement {
	return (
		<div className="flex min-h-0 flex-1 overflow-hidden bg-background">
			<AppSidebar />
			<WorkspacePage />
			<ProviderAuthenticationDialog />
		</div>
	);
}
