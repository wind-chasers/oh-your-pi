import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type ReactElement, type SubmitEvent, useState } from "react";
import { DropdownMenu } from "radix-ui";
import type { PiSessionSummary } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
} from "@view/components/ui/popover";

type SessionListItemProps = {
	disabled: boolean;
	isSelected: boolean;
	onDelete: (session: PiSessionSummary) => Promise<void>;
	onRename: (session: PiSessionSummary, name: string) => Promise<void>;
	onSelect: (session: PiSessionSummary) => Promise<void>;
	session: PiSessionSummary;
};

export function SessionListItem({ disabled, isSelected, onDelete, onRename, onSelect, session }: SessionListItemProps): ReactElement {
	const title = session.name || session.firstMessage || "未命名会话";
	return (
		<div
			aria-current={isSelected ? "page" : undefined}
			className="group flex min-w-0 items-center gap-1 rounded-md transition-colors hover:bg-muted aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
		>
			<button
				className="min-w-0 flex-1 rounded-md px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2"
				disabled={disabled}
				onClick={() => void onSelect(session)}
				title={title}
				type="button"
			>
				<p className="truncate text-sm font-medium">{title}</p>
				<p className="mt-1 truncate text-xs text-muted-foreground">
					{session.messageCount} 条消息 · {new Date(session.modifiedAt).toLocaleDateString()}
				</p>
			</button>
			<SessionActions
				disabled={disabled}
				sessionId={session.id}
				onDelete={() => onDelete(session)}
				onRename={(name) => onRename(session, name)}
				title={title}
			/>
		</div>
	);
}

function SessionActions({ disabled, onDelete, onRename, title, sessionId }: {
	disabled: boolean;
	onDelete: () => Promise<void>;
	onRename: (name: string) => Promise<void>;
	title: string;
	sessionId: string;
}): ReactElement {
	const [name, setName] = useState(title);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
	const [actionPopover, setActionPopover] = useState<"rename" | "delete" | null>(null);
	const isActionDisabled = disabled || isDeleting;

	async function handleRename(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const nextName = name.trim();
		if (!nextName) return;
		await onRename(nextName);
		setActionPopover(null);
	}

	async function handleDelete(): Promise<void> {
		setIsDeleting(true);
		try {
			await onDelete();
			setActionPopover(null);
		} finally {
			setIsDeleting(false);
		}
	}

	function openActionPopover(action: "rename" | "delete"): void {
		setIsActionsMenuOpen(false);
		requestAnimationFrame(() => setActionPopover(action));
	}

	return (
		<Popover
			onOpenChange={(open) => {
				if (!open && !isDeleting) setActionPopover(null);
			}}
			open={actionPopover !== null}
		>
			<PopoverAnchor asChild>
				<div
					className="mr-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[open]:opacity-100"
					data-open={actionPopover !== null ? "" : undefined}
				>
					<DropdownMenu.Root onOpenChange={setIsActionsMenuOpen} open={isActionsMenuOpen}>
						<DropdownMenu.Trigger asChild>
							<Button aria-label={`打开“${title}”的会话操作`} disabled={isActionDisabled} size="icon-xs" type="button" variant="ghost">
								<MoreHorizontal aria-hidden />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Portal>
							<DropdownMenu.Content
								align="end"
								className="z-50 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
								sideOffset={4}
							>
								<DropdownMenu.Group>
									<DropdownMenu.Item
										className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
										disabled={isActionDisabled}
										onSelect={(event) => {
											event.preventDefault();
											setName(title);
											openActionPopover("rename");
										}}
									>
										<Pencil aria-hidden className="size-3.5" />
										重命名
									</DropdownMenu.Item>
									<DropdownMenu.Item
										className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none select-none focus:bg-destructive/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
										disabled={isActionDisabled}
										onSelect={(event) => {
											event.preventDefault();
											openActionPopover("delete");
										}}
									>
										<Trash2 aria-hidden className="size-3.5" />
										删除
									</DropdownMenu.Item>
								</DropdownMenu.Group>
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				</div>
			</PopoverAnchor>
			<PopoverContent align="end" className="w-72 p-3" side="right" sideOffset={8}>
				{actionPopover === "rename" ? (
					<SessionRenameForm
						disabled={isActionDisabled}
						name={name}
						onCancel={() => setActionPopover(null)}
						onNameChange={setName}
						onSubmit={handleRename}
						sessionId={sessionId}
					/>
				) : actionPopover === "delete" ? (
					<SessionDeleteConfirmation
						disabled={isDeleting}
						onCancel={() => setActionPopover(null)}
						onConfirm={handleDelete}
						title={title}
					/>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

function SessionRenameForm({ disabled, name, onCancel, onNameChange, onSubmit, sessionId }: {
	disabled: boolean;
	name: string;
	onCancel: () => void;
	onNameChange: (name: string) => void;
	onSubmit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
	sessionId: string;
}): ReactElement {
	return (
		<form className="flex flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
			<PopoverHeader>
				<PopoverTitle>重命名会话</PopoverTitle>
			</PopoverHeader>
			<label className="sr-only" htmlFor={`session-name-${sessionId}`}>
				会话名称
			</label>
			<input
				autoFocus
				className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2"
				disabled={disabled}
				id={`session-name-${sessionId}`}
				onChange={(event) => onNameChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") onCancel();
				}}
				value={name}
			/>
			<div className="flex justify-end gap-2">
				<Button disabled={disabled} onClick={onCancel} size="sm" type="button" variant="outline">
					取消
				</Button>
				<Button disabled={disabled || !name.trim()} size="sm" type="submit">
					确认
				</Button>
			</div>
		</form>
	);
}

function SessionDeleteConfirmation({ disabled, onCancel, onConfirm, title }: {
	disabled: boolean;
	onCancel: () => void;
	onConfirm: () => Promise<void>;
	title: string;
}): ReactElement {
	return (
		<>
			<PopoverHeader>
				<PopoverTitle>删除会话？</PopoverTitle>
				<PopoverDescription>
					“{title}”将被永久删除，此操作无法撤销。
				</PopoverDescription>
			</PopoverHeader>
			<div className="flex justify-end gap-2">
				<Button disabled={disabled} onClick={onCancel} size="sm" type="button" variant="outline">
					取消
				</Button>
				<Button disabled={disabled} onClick={() => void onConfirm()} size="sm" type="button" variant="destructive">
					删除
				</Button>
			</div>
		</>
	);
}
