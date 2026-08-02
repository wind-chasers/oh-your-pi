import type { WorkspaceFile } from "./model";

const MOCK_FILES: readonly WorkspaceFile[] = [
	{ path: "src/a.ts" },
	{ path: "src/mainview/index.tsx" },
	{ path: "src/mainview/index.css" },
	{ path: "src/mainview/atom/local.tsx" },
	{ path: "src/mainview/atom/unit.ts" },
	{ path: "src/mainview/biz/workspace/index.tsx" },
	{ path: "src/mainview/biz/workspace/sessions/session/session.atom.ts" },
	{ path: "src/mainview/components/ui/hover-card.tsx" },
	{ path: "src/mainview/components/ui/popover.tsx" },
	{ path: "src/shared/pi-contract.ts" },
	{ path: "package.json" },
	{ path: "tsconfig.json" },
	{ path: "vite.config.ts" },
];

export interface FileMentionSource {
	search: (query: string) => readonly WorkspaceFile[];
}

export const fileMentionSource: FileMentionSource = {
	search(query) {
		const normalizedQuery = query.toLocaleLowerCase();
		if (normalizedQuery === "") return MOCK_FILES;
		return MOCK_FILES.filter(({ path }) => path.toLocaleLowerCase().includes(normalizedQuery));
	},
};
