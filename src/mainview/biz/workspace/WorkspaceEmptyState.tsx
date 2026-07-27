import { Bot, FolderOpen, Plus } from "lucide-react";
import { type ReactElement } from "react";
import { Button } from "@view/components/ui/button";
import { AppDisabledAtom } from "@view/states/activity.atom";
import { CreateSessionMutation } from "@view/states/session";

export function WorkspacePlaceholder(): ReactElement {
	return (
		<section className="grid min-h-0 min-w-0 flex-1 place-items-center bg-muted/10 p-8">
			<div className="max-w-sm text-center">
				<div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
					<Bot aria-hidden />
				</div>
				<h1 className="mt-5 text-xl font-semibold">选择一个工作区开始</h1>
				<p className="mt-2 text-sm leading-6 text-muted-foreground">
					从左侧添加项目文件夹。会话和文件都将保留在原位置。
				</p>
			</div>
		</section>
	);
}

type WorkspaceReadyProps = { onOpenFiles: () => void };

export function WorkspaceReady({ onOpenFiles }: WorkspaceReadyProps): ReactElement {
	const disabled = AppDisabledAtom.use();
	const createSession = CreateSessionMutation.use();
	return (
		<section className="grid h-full place-items-center p-8">
			<div className="max-w-sm text-center">
				<div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
					<Bot aria-hidden />
				</div>
				<h1 className="mt-5 text-xl font-semibold">开始一次新的会话</h1>
				<p className="mt-2 text-sm leading-6 text-muted-foreground">
					选择左侧已有会话，或创建一个新的 Pi 会话。
				</p>
				<div className="mt-5 flex justify-center gap-2">
					<Button disabled={disabled} onClick={() => void createSession()} type="button">
						<Plus data-icon="inline-start" />
						新建会话
					</Button>
					<Button onClick={onOpenFiles} type="button" variant="outline">
						<FolderOpen data-icon="inline-start" />
						浏览文件
					</Button>
				</div>
			</div>
		</section>
	);
}
