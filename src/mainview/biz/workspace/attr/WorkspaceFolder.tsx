import { FolderOpen } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Button } from "@view/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@view/components/ui/tooltip";
import { openPiWorkspaceFolder } from "@view/lib/pi-client";
import { toErrorMessage } from "./error";

type WorkspaceFolderProps = {
	onError: (message: string | undefined) => void;
	workspacePath?: string;
};

export function WorkspaceFolder({
	onError,
	workspacePath,
}: WorkspaceFolderProps): ReactElement {
	const [isOpening, setIsOpening] = useState(false);

	async function openWorkspaceFolder(): Promise<void> {
		if (!workspacePath) return;
		onError(undefined);
		setIsOpening(true);
		try {
			await openPiWorkspaceFolder({ workspacePath });
		} catch (requestError) {
			onError(toErrorMessage(requestError, "无法打开工作区文件夹。"));
		} finally {
			setIsOpening(false);
		}
	}

	return (
		<div className="flex min-w-0 items-center gap-2">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						aria-label="在文件管理器中打开工作区文件夹"
						disabled={!workspacePath || isOpening}
						onClick={openWorkspaceFolder}
						size="icon"
						type="button"
						variant="outline"
					>
						<FolderOpen aria-hidden />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="top">在文件管理器中打开</TooltipContent>
			</Tooltip>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium leading-5" title={workspacePath}>
					{workspaceName(workspacePath)}
				</p>
				<p className="truncate text-xs leading-4 text-muted-foreground" title={workspacePath}>
					{workspacePathLabel(workspacePath)}
				</p>
			</div>
		</div>
	);
}

function workspaceName(path: string | undefined): string {
	if (!path) return "未选择工作区";
	const parts = path.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] || path;
}

function workspacePathLabel(path: string | undefined): string {
	if (!path) return "";
	return path.replace(/^(?:[A-Z]:)?[\\/]Users[\\/][^\\/]+/i, "~");
}
