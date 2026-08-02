import { atom } from "@view/atom";

export const NetworkOnlineAtom = atom(navigator.onLine, ({ set, get }) => {
	function updateNetworkStatus(): void {
		set(navigator.onLine);
	}

	window.addEventListener("online", updateNetworkStatus);
	window.addEventListener("offline", updateNetworkStatus);

	return { get };
});

