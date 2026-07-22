import { Plus } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import type { PiWorkspaceSnapshot } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";

type SessionListProps = {
	disabled: boolean;
	onContinueRecentSession: () => Promise<void>;
	onCreateSession: () => Promise<void>;
	onSelectSession: (sessionPath: string) => Promise<void>;
	selectedSessionPath?: string;
	sessions: PiWorkspaceSnapshot["sessions"];
};

export function SessionList({
	disabled,
	onContinueRecentSession,
	onCreateSession,
	onSelectSession,
	selectedSessionPath,
	sessions,
}: SessionListProps): ReactElement {
	const [query, setQuery] = useState("");
	const visibleSessions = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		return [...sessions]
			.sort(
				(left, right) =>
					Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt),
			)
			.filter(
				(session) =>
					!normalizedQuery ||
					`${session.name ?? ""}\n${session.firstMessage}`
						.toLocaleLowerCase()
						.includes(normalizedQuery),
			);
	}, [query, sessions]);
	return (
		<aside
			aria-label="会话列表"
			className="flex min-h-0 w-65 flex-col border-r bg-muted/20"
		>
			<div className="flex items-center justify-between gap-2 border-b px-3 h-10">
				<div className="min-w-0">
					<p className="text-sm font-semibold">会话 ({sessions.length})</p>
				</div>
				<Button
					aria-label="新建会话"
					disabled={disabled}
					onClick={() => void onCreateSession()}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<Plus aria-hidden />
				</Button>
			</div>
			<div className="p-3">
				<label className="sr-only" htmlFor="session-search">
					搜索会话
				</label>
				<input
					className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2"
					disabled={disabled}
					id="session-search"
					onChange={(event) => setQuery(event.target.value)}
					placeholder="搜索会话"
					value={query}
				/>
			</div>
			<nav
				aria-label="当前工作区会话"
				className="min-h-0 flex-1 overflow-y-auto p-2"
			>
				{visibleSessions.map((session) => (
					<SessionListItem
						disabled={disabled}
						isSelected={selectedSessionPath === session.path}
						key={session.id}
						onSelect={onSelectSession}
						session={session}
					/>
				))}
				{visibleSessions.length === 0 ? (
					<EmptySessionList
						disabled={disabled}
						hasSessions={sessions.length > 0}
						onContinue={onContinueRecentSession}
					/>
				) : null}
			</nav>
		</aside>
	);
}

function SessionListItem({
	disabled,
	isSelected,
	onSelect,
	session,
}: {
	disabled: boolean;
	isSelected: boolean;
	onSelect: (sessionPath: string) => Promise<void>;
	session: PiWorkspaceSnapshot["sessions"][number];
}): ReactElement {
	const title = session.name || session.firstMessage || "未命名会话";
	return (
		<button
			aria-current={isSelected ? "page" : undefined}
			className="mb-1 w-full rounded-md px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
			disabled={disabled}
			onClick={() => void onSelect(session.path)}
			title={title}
			type="button"
		>
			<p className="truncate text-sm font-medium">{title}</p>
			<p className="mt-1 truncate text-xs text-muted-foreground">
				{session.messageCount} 条消息 ·{" "}
				{new Date(session.modifiedAt).toLocaleDateString()}
			</p>
		</button>
	);
}

function EmptySessionList({
	disabled,
	hasSessions,
	onContinue,
}: {
	disabled: boolean;
	hasSessions: boolean;
	onContinue: () => Promise<void>;
}): ReactElement {
	return (
		<div className="px-2 py-5 text-center text-xs text-muted-foreground">
			<p>{hasSessions ? "没有匹配的会话。" : "还没有会话。"}</p>
			{!hasSessions ? (
				<Button
					className="mt-3"
					disabled={disabled}
					onClick={() => void onContinue()}
					size="xs"
					type="button"
					variant="outline"
				>
					继续最近会话
				</Button>
			) : null}
		</div>
	);
}
