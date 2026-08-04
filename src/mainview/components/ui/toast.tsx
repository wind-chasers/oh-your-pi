import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { Toast } from "radix-ui";
import type { ReactElement } from "react";
import { cn } from "@view/lib/utils";

export type ToastNotice = {
	description?: string;
	duration: number | null;
	expiresAt: number | null;
	id: number;
	title: string;
	variant: "error" | "info" | "success";
};

export type ToastInput = Omit<ToastNotice, "duration" | "expiresAt" | "id"> & {
	duration?: number | null;
};

export const TOAST_DURATION_MS = 5_000;

type ToasterProps = {
	onDismiss: (id: number) => void;
	toasts: readonly ToastNotice[];
};

const variantStyles = {
	error: "border-destructive/40",
	info: "border-primary/30",
	success: "border-primary/30",
} as const;

const variantIcons = {
	error: CircleAlert,
	info: Info,
	success: CheckCircle2,
} as const;

export function Toaster({ onDismiss, toasts }: ToasterProps): ReactElement {
	return (
		<Toast.Provider duration={TOAST_DURATION_MS} label="通知" swipeDirection="right">
			{toasts.map((toast) => <ToastItem key={toast.id} onDismiss={onDismiss} toast={toast} />)}
			<Toast.Viewport className="fixed right-5 bottom-5 z-50 flex max-h-screen w-full max-w-sm flex-col-reverse gap-2 p-5 outline-none" />
		</Toast.Provider>
	);
}

function ToastItem({ onDismiss, toast }: { onDismiss: (id: number) => void; toast: ToastNotice }): ReactElement {
	const Icon = variantIcons[toast.variant];
	return (
		<Toast.Root
			defaultOpen
			duration={toast.duration ?? Infinity}
			className={cn(
				"group relative flex w-full items-start gap-3 rounded-xl border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full",
				variantStyles[toast.variant],
			)}
			onOpenChange={(open) => {
				if (!open) onDismiss(toast.id);
			}}
		>
			<Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
			<div className="min-w-0 flex-1">
				<Toast.Title className="font-medium">{toast.title}</Toast.Title>
				{toast.description ? <Toast.Description className="mt-0.5 text-xs text-muted-foreground">{toast.description}</Toast.Description> : null}
			</div>
			<Toast.Close aria-label="关闭通知" className="shrink-0 rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2">
				<X aria-hidden className="size-3" />
			</Toast.Close>
		</Toast.Root>
	);
}
