import { Utils } from "electrobun/bun";

export type DesktopSystem = {
	chooseWorkspaceDirectory(): Promise<string | null>;
	chooseImageFiles(): Promise<string[]>;
	openExternalUrl(url: string): void;
};


export function createDesktopSystem(): DesktopSystem {
	return {
		async chooseImageFiles() {
			const paths = await Utils.openFileDialog({
				allowedFileTypes: "jpg,jpeg,png,webp,gif,bmp,tif,tiff,heic,heif,avif",
				allowsMultipleSelection: true,
				canChooseDirectory: false,
				canChooseFiles: true,
			});
			return paths.filter(Boolean);
		},
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
