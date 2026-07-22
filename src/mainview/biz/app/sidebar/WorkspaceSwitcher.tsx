import { Plus } from "lucide-react";
import { type ReactElement } from "react";
import { Button } from "@view/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@view/components/ui/tooltip";
import { cn } from "@view/lib/utils";

const WORKSPACE_TONES = [
	"bg-rose-500",
	"bg-amber-500",
	"bg-emerald-500",
	"bg-sky-500",
	"bg-violet-500",
];

type WorkspaceSwitcherProps = {
	disabled: boolean;
	onChooseWorkspace: () => Promise<void>;
	onSelectWorkspace: (workspacePath: string) => Promise<void>;
	recentWorkspaces: string[];
	selectedWorkspacePath?: string;
};

export function WorkspaceSwitcher({
	disabled,
	onChooseWorkspace,
	onSelectWorkspace,
	recentWorkspaces,
	selectedWorkspacePath,
}: WorkspaceSwitcherProps): ReactElement {
	return (
		<div className="flex w-full flex-col items-center gap-2.5">
			{recentWorkspaces.map((path, index) => {
				const isSelected = path === selectedWorkspacePath;
				return (
					<Tooltip key={path}>
						<TooltipTrigger asChild>
							<button
								aria-current={isSelected ? "page" : undefined}
								aria-label={`打开工作区 ${workspaceName(path)}`}
								className={cn(
									"flex size-6 items-center justify-center rounded-md text-[11px] font-semibold text-white outline-none transition-opacity duration-150 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-[current=page]:ring-2 aria-[current=page]:ring-muted-foreground/65 aria-[current=page]:ring-offset-2 aria-[current=page]:ring-offset-background",
									WORKSPACE_TONES[index % WORKSPACE_TONES.length],
								)}
								disabled={disabled}
								onClick={() => void onSelectWorkspace(path)}
								type="button"
							>
								{workspaceName(path).slice(0, 1).toLocaleUpperCase()}
							</button>
						</TooltipTrigger>
						<TooltipContent side="right">{path}</TooltipContent>
					</Tooltip>
				);
			})}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						aria-label="添加工作区"
						className="size-7 rounded-md [&_svg]:size-3.5"
						disabled={disabled}
						onClick={() => void onChooseWorkspace()}
						size="icon"
						type="button"
						variant="ghost"
					>
						<Plus aria-hidden />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="right">添加工作区</TooltipContent>
			</Tooltip>
		</div>
	);
}

function workspaceName(path: string): string {
	const parts = path.split("/").filter(Boolean);
	return parts[parts.length - 1] || path;
}
