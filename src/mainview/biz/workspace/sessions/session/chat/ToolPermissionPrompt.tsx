import { useState } from "react";
import { Button } from "@view/components/ui/button";
import { type ChatSession, type ChatTranscriptTail } from "@view/chat-store";

type ToolPermissionPromptProps = {
	session: ChatSession;
	tail: ChatTranscriptTail;
};

export function ToolPermissionPrompt({ session, tail }: ToolPermissionPromptProps) {
	const request = tail.type === "live-agent" ? tail.output.permissionRequests[0] : undefined;
	const [isDeciding, setIsDeciding] = useState(false);

	if (!request) return null;

	async function decide(allowed: boolean): Promise<void> {
		setIsDeciding(true);
		try {
			await session.respondToPermission(request!, allowed);
		} finally {
			setIsDeciding(false);
		}
	}

	return (
		<section className="mx-auto mb-3 max-w-3xl rounded-lg border border-amber-500/50 bg-amber-500/10 p-4" role="alert">
			<p className="font-medium">{request.title} · {request.toolName}</p>
			<p className="mt-1 text-sm text-muted-foreground">
				{request.isDangerous ? "危险操作可能修改或破坏本机状态。" : "该操作会修改文件或执行本机命令。"}
			</p>
			<pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap wrap-break-word rounded bg-background/70 p-3 text-xs">
				{request.message}
			</pre>
			<div className="mt-3 flex justify-end gap-2">
				<Button disabled={isDeciding} onClick={() => void decide(false)} size="sm" type="button" variant="outline">
					拒绝
				</Button>
				<Button disabled={isDeciding} onClick={() => void decide(true)} size="sm" type="button">
					允许一次
				</Button>
			</div>
		</section>
	);
}
