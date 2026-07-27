import { Utils } from "electrobun/bun";

export type DesktopSystem = {
	chooseWorkspaceDirectory(): Promise<string | null>;
	openExternalUrl(url: string): void;
};

export function createDesktopSystem(): DesktopSystem {
	return {
		async chooseWorkspaceDirectory() {
			const [workspacePath] = await Utils.openFileDialog({
				allowsMultipleSelection: false,
				canChooseDirectory: true,
				canChooseFiles: false,
			});
			return workspacePath || null;
		},
		openExternalUrl(url) {
			Utils.openExternal(url);
		},
	};
}
