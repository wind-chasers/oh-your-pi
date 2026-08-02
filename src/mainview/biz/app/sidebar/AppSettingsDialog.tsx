import { Settings2 } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import type { PiAuthenticationStatus } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@view/components/ui/dialog";
import { Switch } from "@view/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@view/components/ui/tooltip";
import { subscribeToOpenAppSettings } from "@view/lib/pi-client";
import { AppDisabledAtom } from "@view/states/activity.atom";
import {
	AuthenticationAtom,
	AuthenticationDialogOpenAtom,
} from "@view/states/authentication.atom";
import { NetworkOnlineAtom } from "@view/states/network.atom";
import { ShowThinkingAtom } from "@view/states/preferences.atom";


export function AppSettingsDialog(): ReactElement {
	const [open, setOpen] = useState(false);
	const disabled = AppDisabledAtom.use();
	const authentication = AuthenticationAtom.useValue();
	const isNetworkOnline = NetworkOnlineAtom.useValue();
	const [showThinking, thinking] = ShowThinkingAtom.use();
	const setAuthenticationOpen = AuthenticationDialogOpenAtom.useSet();
	useEffect(() => subscribeToOpenAppSettings(() => setOpen(true)), []);
	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<Tooltip>
				<TooltipTrigger asChild>
					<DialogTrigger asChild>
						<Button
							aria-label="应用设置"
							size="icon-sm"
							type="button"
							variant="ghost"
						>
							<Settings2 aria-hidden />
						</Button>
					</DialogTrigger>
				</TooltipTrigger>
				<TooltipContent side="right">设置</TooltipContent>
			</Tooltip>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>应用设置</DialogTitle>
					<DialogDescription>这些偏好保存在当前设备上。</DialogDescription>
				</DialogHeader>
				<div className="flex items-center justify-between gap-6 rounded-lg border bg-muted/30 p-3">
					<div>
						<p className="text-sm font-medium">显示模型思考过程</p>
						<p className="mt-1 text-xs text-muted-foreground">
							在会话中展示流式推理文本。
						</p>
					</div>
					<Switch
						aria-label="显示模型思考过程"
						checked={showThinking}
						onCheckedChange={thinking.change}
					/>
				</div>
				<p className="text-xs text-muted-foreground">
					网络状态：{isNetworkOnline ? "在线" : "离线"}
				</p>
				<section className="border-t pt-4">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-sm font-medium">模型提供商</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{providerStatusMessage(authentication)}
							</p>
						</div>
						<Button disabled={disabled} onClick={() => setAuthenticationOpen(true)} size="xs" type="button" variant="outline">
							管理
						</Button>
					</div>
				</section>
			</DialogContent>
		</Dialog>
	);
}

function providerStatusMessage(authentication?: PiAuthenticationStatus[]): string {
	if (!authentication) return "选择工作区后查看提供商连接状态。";
	if (authentication.some((provider) => provider.status === "available")) return "至少一个提供商已连接。";
	return "尚未连接可用的模型提供商。";
}
