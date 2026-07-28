import { atom } from "@view/atom";

export const NetworkOnlineAtom = atom(navigator.onLine, (_get, set) => {
	function updateNetworkStatus(): void {
		set(navigator.onLine);
	}

	window.addEventListener("online", updateNetworkStatus);
	window.addEventListener("offline", updateNetworkStatus);
});

