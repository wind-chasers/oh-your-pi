import { atom } from "@view/atom";
import { readDarkMode, setDarkMode } from "@view/lib/theme";

export const DarkModeAtom = atom(false, (get, set) => {
	set(readDarkMode());

	function change(dark: boolean): void {
		if (dark === get()) return;
		setDarkMode(dark);
		set(dark);
	}

	return { change };
});
