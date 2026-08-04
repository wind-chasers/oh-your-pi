import { CircleAlert, WifiOff } from "lucide-react";
import { type ReactElement } from "react";
import { WorkspaceErrorAtom } from "@view/states/activity.atom";
import { NetworkOnlineAtom } from "@view/states/network.atom";


export function WorkspaceAlerts(): ReactElement {
	const error = WorkspaceErrorAtom.useValue();
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
				<p
					className="flex items-center gap-2 border-b bg-destructive/10 px-4 py-2 text-xs text-destructive"
					role="alert"
				>
					<CircleAlert aria-hidden className="size-3.5" />
					{error}
				</p>
			) : null}
		</>
	);
}
