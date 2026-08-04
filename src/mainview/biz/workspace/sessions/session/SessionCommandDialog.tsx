import { LoaderCircle } from "lucide-react";
import { type ReactElement, useEffect } from "react";
import type { PiSessionSummary } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@view/components/ui/dialog";
import { AppDisabledAtom } from "@view/states/activity.atom";
import { SelectedSessionAtom, WorkspaceAtom } from "@view/states/current.atom";
import {
	DropSessionMutation,
	ForkSessionMutation,
	SessionCommandDialogAtom,
} from "@view/states/session";

export function SessionCommandDialog(): ReactElement | null {
	const [action, setAction] = SessionCommandDialogAtom.use();
	const disabled = AppDisabledAtom.use();
	const workspace = WorkspaceAtom.useValue();
	const selection = SelectedSessionAtom.useValue();
	const forkSession = ForkSessionMutation.use();
	const dropSession = DropSessionMutation.use();
	const session = findSelectedSession(workspace?.sessions, selection?.sessionId);

	useEffect(() => {
		if (action && !session) setAction(null);
	}, [action, session, setAction]);
	if (!action || !session) return null;
	const selectedSession = session;
	const drop = action === "drop";
	const title = selectedSession.name || selectedSession.firstMessage || "未命名会话";

	async function confirm(): Promise<void> {
		const completed = drop
			? await dropSession(selectedSession)
			: await forkSession(selectedSession);
		if (completed) setAction(null);
	}

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open && !disabled) setAction(null);
			}}
			open
		>
			<DialogContent className="sm:max-w-md" showCloseButton={!disabled}>
				<DialogHeader>
					<DialogTitle>{drop ? "删除当前会话？" : "复制当前会话？"}</DialogTitle>
					<DialogDescription>
						{drop
							? `“${title}”将被永久删除，并立即创建一个新会话。此操作无法撤销。`
							: `将创建“${title}”当前活动分支的独立副本；原会话不会修改。`}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button disabled={disabled} onClick={() => setAction(null)} type="button" variant="outline">
						取消
					</Button>
					<Button
						disabled={disabled}
						onClick={() => void confirm()}
						type="button"
						variant={drop ? "destructive" : "default"}
					>
						{disabled ? <LoaderCircle aria-hidden className="animate-spin" data-icon="inline-start" /> : null}
						{drop ? "删除并新建" : "复制会话"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function findSelectedSession(
	sessions: readonly PiSessionSummary[] | undefined,
	sessionId: string | undefined,
): PiSessionSummary | undefined {
	return sessions?.find((session) => session.id === sessionId);
}
