import { Bot, Moon, Sun } from "lucide-react";
import { type ReactElement } from "react";
import type { PiAuthenticationStatus } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@view/components/ui/tooltip";
import { AppSettingsDialog } from "./AppSettingsDialog";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type AppSidebarProps = {
	authentication?: PiAuthenticationStatus[];
	disabled: boolean;
	isDarkMode: boolean;
	isNetworkOnline: boolean;
	onChooseWorkspace: () => Promise<void>;
	onDarkModeChange: (value: boolean) => void;
	onOpenAuthentication: () => void;
	onSelectWorkspace: (workspacePath: string) => Promise<void>;
	onShowThinkingChange: (value: boolean) => void;
	recentWorkspaces: string[];
	selectedWorkspacePath?: string;
	showThinking: boolean;
};

export function AppSidebar({
	authentication,
	disabled,
	isDarkMode,
	isNetworkOnline,
	onChooseWorkspace,
	onDarkModeChange,
	onOpenAuthentication,
	onSelectWorkspace,
	onShowThinkingChange,
	recentWorkspaces,
	selectedWorkspacePath,
	showThinking,
}: AppSidebarProps): ReactElement {
	return (
		<aside
			aria-label="工作区"
			className="flex w-11 shrink-0 flex-col items-center border-r bg-background py-2"
		>
			<WorkspaceSwitcher
				disabled={disabled}
				onChooseWorkspace={onChooseWorkspace}
				onSelectWorkspace={onSelectWorkspace}
				recentWorkspaces={recentWorkspaces}
				selectedWorkspacePath={selectedWorkspacePath}
			/>
			<div className="mt-auto flex flex-col items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							aria-label={isDarkMode ? "切换至浅色模式" : "切换至深色模式"}
							aria-pressed={isDarkMode}
							onClick={() => onDarkModeChange(!isDarkMode)}
							size="icon-sm"
							type="button"
							variant="ghost"
						>
							{isDarkMode ? <Sun aria-hidden /> : <Moon aria-hidden />}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">
						{isDarkMode ? "切换至浅色模式" : "切换至深色模式"}
					</TooltipContent>
				</Tooltip>
				<AppSettingsDialog
					authentication={authentication}
					disabled={disabled}
					isNetworkOnline={isNetworkOnline}
					onOpenAuthentication={onOpenAuthentication}
					onShowThinkingChange={onShowThinkingChange}
					showThinking={showThinking}
				/>
				<div
					aria-label="Oh Your Pi"
					className="flex size-7 items-center justify-center rounded-lg border"
					role="img"
				>
					<Bot aria-hidden size={14} />
				</div>
			</div>
		</aside>
	);
}
