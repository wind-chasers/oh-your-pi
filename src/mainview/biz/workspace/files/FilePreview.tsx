import { FileCode2, X } from "lucide-react";
import { type ReactElement } from "react";
import type { PiWorkspaceFileContent } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import { SyntaxHighlightedCode } from "@view/components/code-view/syntax-highlighted-code";
import { resolveFileLanguage } from "@view/components/code-view/syntax-languages";

type FilePreviewProps = {
	file: PiWorkspaceFileContent;
	onClose: () => void;
};

export function FilePreview({ file, onClose }: FilePreviewProps): ReactElement {
	const language = resolveFileLanguage(file.path);
	return (
		<section
			aria-label="文件内容"
			className="flex-1 flex h-full border-l min-w-0 flex-col overflow-hidden bg-background"
		>
			<header className="flex h-10 items-center gap-2 border-b px-3">
				<FileCode2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
				<p className="min-w-0 flex-1 truncate text-sm font-medium" title={file.path}>
					{file.path}
				</p>
				<Button aria-label="关闭文件预览" onClick={onClose} size="icon-xs" type="button" variant="ghost">
					<X aria-hidden />
				</Button>
			</header>
			{file.isTruncated ? (
				<p className="border-b bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
					文件超过 512 KB，仅展示开头内容。
				</p>
			) : null}
			<pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-5 text-foreground">
				<SyntaxHighlightedCode enabled={!file.isBinary} language={language} showLineNumbers>{file.content}</SyntaxHighlightedCode>
			</pre>
		</section>
	);
}
