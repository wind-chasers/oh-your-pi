import type { PiFileSearchRequest } from "@shared/pi-contract";
import { searchPiWorkspaceFiles } from "@view/lib/pi-client";
import type { WorkspaceFile } from "./model";

export type FileMentionSearchResult = {
	degraded: boolean;
	files: readonly WorkspaceFile[];
};

export async function searchWorkspaceFiles(
	request: PiFileSearchRequest,
): Promise<FileMentionSearchResult> {
	const result = await searchPiWorkspaceFiles(request);
	return {
		degraded: result.degraded,
		files: result.items.map(([path, isDir]) => ({ isDirectory: isDir === 1, path })),
	};
}
