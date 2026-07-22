import { useCallback, useEffect, useRef, useState } from "react";
import type { PiWorkspaceFileContent } from "@shared/pi-contract";
import { readPiWorkspaceFile } from "@view/lib/pi-client";

type SelectedWorkspaceFile = {
	file: PiWorkspaceFileContent;
	workspacePath: string;
};
type FileSelectionError = { message: string; workspacePath: string };

export function useWorkspaceFiles(workspacePath?: string): {
	clearSelection: () => void;
	selectFile: (relativePath: string) => Promise<void>;
	selectedFile?: PiWorkspaceFileContent;
	selectionError?: string;
} {
	const [selected, setSelected] = useState<SelectedWorkspaceFile>();
	const [error, setError] = useState<FileSelectionError>();
	const request = useRef(0);
	useEffect(() => {
		request.current += 1;
		setSelected(undefined);
		setError(undefined);
	}, [workspacePath]);
	const clearSelection = useCallback((): void => {
		request.current += 1;
		setSelected(undefined);
		setError(undefined);
	}, []);
	const selectFile = useCallback(
		async (relativePath: string): Promise<void> => {
			if (!workspacePath) return;
			const requestId = ++request.current;
			setError(undefined);
			try {
				const file = await readPiWorkspaceFile({ relativePath, workspacePath });
				if (requestId === request.current) setSelected({ file, workspacePath });
			} catch (requestError) {
				if (requestId === request.current)
					setError({
						message:
							requestError instanceof Error
								? requestError.message
								: "无法读取文件内容。",
						workspacePath,
					});
			}
		},
		[workspacePath],
	);
	return {
		clearSelection,
		selectFile,
		selectedFile:
			selected?.workspacePath === workspacePath ? selected?.file : undefined,
		selectionError:
			error?.workspacePath === workspacePath ? error?.message : undefined,
	};
}
