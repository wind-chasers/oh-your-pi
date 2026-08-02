import { Plus } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Button } from "@view/components/ui/button";
import { AppDisabledAtom } from "@view/states/activity.atom";
import { SelectedSessionAtom, WorkspaceAtom } from "@view/states/current.atom";
import {
	ContinueRecentSessionMutation,
	CreateSessionMutation,
	DeleteSessionMutation,
	RenameSessionMutation,
	SelectSessionMutation,
} from "@view/states/session";
import { SessionListItem } from "./SessionListItem";


export function SessionList(): ReactElement {
	const disabled = AppDisabledAtom.use();
	const sessions = WorkspaceAtom.useValue()?.sessions ?? [];
	const selectedSession = SelectedSessionAtom.useValue();
	const continueRecentSession = ContinueRecentSessionMutation.use();
	const createSession = CreateSessionMutation.use();
	const selectSession = SelectSessionMutation.use();
	const deleteSession = DeleteSessionMutation.use();
	const renameSession = RenameSessionMutation.use();
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
			className="min-h-0 flex-1 flex flex-col"
		>
			<div className="flex items-center justify-between gap-2 border-b px-3 h-10">
				<div className="min-w-0">
					<p className="text-sm font-semibold">会话 ({sessions.length})</p>
				</div>
				<Button
					aria-label="新建会话"
					disabled={disabled}
					onClick={() => void createSession()}
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
						isSelected={selectedSession?.sessionId === session.id}
						key={session.id}
						onSelect={selectSession}
						onDelete={deleteSession}
						onRename={renameSession}
						session={session}
					/>
				))}
				{visibleSessions.length === 0 ? (
					<EmptySessionList
						disabled={disabled}
						hasSessions={sessions.length > 0}
						onContinue={continueRecentSession}
					/>
				) : null}
			</nav>
		</aside>
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
