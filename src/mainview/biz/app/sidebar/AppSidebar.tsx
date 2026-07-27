import { Bot, Moon, Sun } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@view/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@view/components/ui/tooltip";
import { DarkModeAtom } from "@view/states/theme.atom";
import { AppSettingsDialog } from "./AppSettingsDialog";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";


export function AppSidebar(): ReactElement {
	const [isDarkMode, theme] = DarkModeAtom.use();
	return (
		<aside
			aria-label="工作区"
			className="flex w-11 shrink-0 flex-col items-center border-r bg-background py-2"
		>
			<WorkspaceSwitcher />
			<div className="mt-auto flex flex-col items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							aria-label={isDarkMode ? "切换至浅色模式" : "切换至深色模式"}
							aria-pressed={isDarkMode}
							onClick={() => theme.change(!isDarkMode)}
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
				<AppSettingsDialog />
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
