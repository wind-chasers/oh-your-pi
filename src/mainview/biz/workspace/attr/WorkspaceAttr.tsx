import { type ReactElement, useState } from "react";
import { Separator } from "@view/components/ui/separator";
import { WorkspaceAtom } from "@view/states/current.atom";
import { WorkspaceFolder } from "./WorkspaceFolder";
import { WorkspaceGitBranch } from "./WorkspaceGitBranch";

/**
 * 展示当前工作区路径和本地 Git 分支。
 */
export function WorkspaceAttr(): ReactElement {
	const workspacePath = WorkspaceAtom.useData()?.workspacePath;
	const [error, setError] = useState<string>();
	return (
		<section aria-label="工作区属性" className="shrink-0 bg-muted/20">
			<Separator />
			<div className="flex flex-col gap-2 px-3 py-2">
				<WorkspaceFolder onError={setError} workspacePath={workspacePath} />
				<WorkspaceGitBranch onError={setError} workspacePath={workspacePath} />
				{error ? <p className="text-xs leading-4 text-destructive" role="alert">{error}</p> : null}
			</div>
		</section>
	);
}


