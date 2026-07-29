import { CircleAlert, GitBranch, X } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import type { PiWorkspaceGit } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
} from "@view/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@view/components/ui/select";
import {
	inspectPiWorkspaceGit,
	switchPiWorkspaceGitBranch,
} from "@view/lib/pi-client";
import { toErrorMessage } from "./error";

type WorkspaceGitBranchProps = {
	onError: (message: string | undefined) => void;
	workspacePath?: string;
};

export function WorkspaceGitBranch({
	onError,
	workspacePath,
}: WorkspaceGitBranchProps): ReactElement | null {
	const [gitRepository, setGitRepository] = useState<PiWorkspaceGit | null>();
	const [branchError, setBranchError] = useState<string>();
	const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);

	useEffect(() => {
		let disposed = false;
		if (!workspacePath) {
			setBranchError(undefined);
			setGitRepository(null);
			return;
		}

		onError(undefined);
		setBranchError(undefined);
		setGitRepository(undefined);
		void inspectPiWorkspaceGit({ workspacePath })
			.then((repository) => {
				if (!disposed) setGitRepository(repository);
			})
			.catch((requestError) => {
				if (!disposed) {
					setGitRepository(null);
					onError(toErrorMessage(requestError, "无法读取 Git 分支。"));
				}
			});

		return () => {
			disposed = true;
		};
	}, [onError, workspacePath]);

	async function switchBranch(branch: string): Promise<void> {
		if (!workspacePath) return;
		setBranchError(undefined);
		onError(undefined);
		setIsSwitchingBranch(true);
		try {
			setGitRepository(await switchPiWorkspaceGitBranch({ branch, workspacePath }));
		} catch (requestError) {
			setBranchError(toErrorMessage(requestError, "无法切换 Git 分支。"));
		} finally {
			setIsSwitchingBranch(false);
		}
	}

	if (!gitRepository) return null;

	return (
		<Popover open={Boolean(branchError)}>
			<PopoverAnchor asChild>
				<div>
					<Select
						disabled={isSwitchingBranch || gitRepository.branches.length === 0}
						onValueChange={(branch) => void switchBranch(branch)}
						value={gitRepository.currentBranch ?? undefined}
					>
						<SelectTrigger aria-label="Git 分支" className="w-full text-xs" indicator="up" size="sm">
							<GitBranch aria-hidden className="size-3.5 text-muted-foreground" />
							<SelectValue placeholder={gitRepository.branches.length === 0 ? "没有本地分支" : "游离 HEAD"} />
						</SelectTrigger>
						<SelectContent position="popper">
							<SelectGroup>
								{gitRepository.branches.map((branch) => (
									<SelectItem key={branch} value={branch}>
										{branch}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				className="w-72 p-3"
				onEscapeKeyDown={() => setBranchError(undefined)}
				onOpenAutoFocus={(event) => event.preventDefault()}
				side="top"
				sideOffset={8}
			>
				<div className="flex items-start gap-2">
					<CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
					<PopoverHeader className="min-w-0 flex-1 gap-1">
						<PopoverTitle className="text-sm">无法切换分支</PopoverTitle>
						<PopoverDescription className="max-h-28 overflow-y-auto text-xs leading-5 whitespace-pre-wrap">
							{branchError}
						</PopoverDescription>
					</PopoverHeader>
					<Button
						aria-label="关闭分支切换错误提示"
						className="-mt-1 shrink-0"
						onClick={() => setBranchError(undefined)}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<X aria-hidden />
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
