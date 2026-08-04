import { type ReactElement, useCallback, useEffect } from "react";
import { Toaster } from "@view/components/ui/toast";
import { AppToastsAtom, getToastDelay } from "@view/states/toast.atom";

export function AppToaster(): ReactElement {
	const [toasts, setToasts] = AppToastsAtom.use();
	const dismiss = useCallback(
		(id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)),
		[setToasts],
	);

	useEffect(() => {
		const timers = toasts.flatMap((toast) => {
			const delay = getToastDelay(toast);
			return delay === null ? [] : [window.setTimeout(() => dismiss(toast.id), delay)];
		});
		return () => timers.forEach(window.clearTimeout);
	}, [dismiss, toasts]);

	return <Toaster onDismiss={dismiss} toasts={toasts} />;
}
