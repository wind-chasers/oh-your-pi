import { CircleAlert, WifiOff, X } from "lucide-react";
import { type ReactElement } from "react";
import { Button } from "@view/components/ui/button";
import { WorkspaceErrorAtom } from "@view/states/activity.atom";
import { NetworkOnlineAtom } from "@view/states/network.atom";

export function WorkspaceAlerts(): ReactElement {
	const [error, setError] = WorkspaceErrorAtom.use();
	const isNetworkOnline = NetworkOnlineAtom.useValue();

	return (
		<>
			{!isNetworkOnline ? (
				<p className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-300">
					<WifiOff aria-hidden className="size-3.5" />
					网络离线；仍可浏览本地会话，但模型请求可能失败。
				</p>
			) : null}
			{error ? (
				<div
					className="flex items-center gap-2 bg-destructive/10 px-4 py-2 text-xs text-destructive"
					role="alert"
				>
					<CircleAlert aria-hidden className="size-3.5 shrink-0" />
					<span className="min-w-0 flex-1">{error}</span>
					<Button
						aria-label="关闭错误提示"
						className="-my-1 shrink-0"
						onClick={() => setError(undefined)}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<X aria-hidden />
					</Button>
				</div>
			) : null}
		</>
	);
}
