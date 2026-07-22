export const MAX_RECENT_WORKSPACES = 5;

export function updateRecentWorkspaces(
	workspaces: string[],
	workspacePath: string,
): string[] {
	const uniqueWorkspaces = [...new Set(workspaces)];
	if (uniqueWorkspaces.includes(workspacePath)) return uniqueWorkspaces;
	return [...uniqueWorkspaces, workspacePath].slice(-MAX_RECENT_WORKSPACES);
}
