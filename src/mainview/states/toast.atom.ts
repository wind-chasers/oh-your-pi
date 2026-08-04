import { atom } from "@view/atom";
import { TOAST_DURATION_MS, type ToastInput, type ToastNotice } from "@view/components/ui/toast";

let nextToastId = 0;

export const AppToastsAtom = atom<ToastNotice[]>([]);

export function createToast(input: ToastInput): ToastNotice {
	const duration = input.duration === undefined ? TOAST_DURATION_MS : input.duration;
	return {
		...input,
		duration,
		expiresAt: duration === null ? null : Date.now() + duration,
		id: ++nextToastId,
	};
}

export function getToastDelay(toast: ToastNotice, now = Date.now()): number | null {
	return toast.expiresAt === null ? null : Math.max(0, toast.expiresAt - now);
}