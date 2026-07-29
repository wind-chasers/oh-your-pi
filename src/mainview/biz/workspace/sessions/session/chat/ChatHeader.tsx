import { CircleStop, FolderTree } from "lucide-react";
import { type ReactElement } from "react";
import type { PiOpenedSession } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import { ContextBadge } from "./ContextBadge";
import { ChatSession } from "@view/chat-store";

type ChatHeaderProps = {
	entryCount: number;
	isFileTreeOpen: boolean;
	isStreaming: boolean;
	onToggleFileTree: () => void;
	session: ChatSession;
	openedSession: PiOpenedSession;
	title: string;
};

const NOOP = () => {};

export function ChatHeader({
	entryCount,
	isFileTreeOpen,
	isStreaming,
	onToggleFileTree,
	session,
	openedSession,
	title,
}: ChatHeaderProps): ReactElement {
	return (
		<header className="flex items-center justify-between gap-4 border-b px-5 h-10">
			<div className="min-w-0 flex flex-1 items-center gap-2">
				<div className="truncate font-semibold max-w-[50%]">{title}</div>
				<p className="mt-0.5 text-xs text-muted-foreground whitespace-nowrap">
					{isStreaming ? "正在生成回复" : `${entryCount} 条消息`}
				</p>
			</div>
			<div className="flex items-center gap-1">
				<ContextBadge openedSession={openedSession} />
				{isStreaming ? (
					<Button onClick={() => session.abort().catch(NOOP)} size="sm" type="button" variant="outline">
						<CircleStop aria-hidden />
						停止
					</Button>
				) : null}
				<Button
					aria-label={isFileTreeOpen ? "关闭文件树" : "打开文件树"}
					onClick={onToggleFileTree}
					size="icon-sm"
					variant={isFileTreeOpen ? "default" : "ghost"}
				>
					<FolderTree aria-hidden />
				</Button>
			</div>
		</header>
	);
}
