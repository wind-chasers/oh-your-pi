import type { ReactElement } from "react";
import { TooltipProvider } from "@view/components/ui/tooltip";
import { AppShell } from "@view/biz/app/AppShell";

const APPLICATION_NAME = "Oh Your Pi";

export default function App(): ReactElement {
	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-background">
			<header className="electrobun-webkit-app-region-drag flex h-8 shrink-0 items-center justify-center border-b select-none">
				<span className="text-sm font-semibold">{APPLICATION_NAME}</span>
			</header>
			<TooltipProvider>
				<AppShell />
			</TooltipProvider>
		</div>
	);
}
