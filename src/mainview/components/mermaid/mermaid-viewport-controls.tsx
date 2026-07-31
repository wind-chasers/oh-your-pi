import { Hand, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { type ReactElement } from "react";
import { Button } from "@view/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@view/components/ui/tooltip";

type MermaidViewportControlsProps = {
	panEnabled: boolean;
	onReset: () => void;
	onTogglePan: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	zoom: number;
};

export function MermaidViewportControls({
	panEnabled,
	onReset,
	onTogglePan,
	onZoomIn,
	onZoomOut,
	zoom,
}: MermaidViewportControlsProps): ReactElement {
	const panLabel = panEnabled ? "停用抓手平移" : "启用抓手平移";
	return (
		<>
			<ControlButton label="放大 5%" onClick={onZoomIn}><ZoomIn aria-hidden /></ControlButton>
			<ControlButton label="缩小 5%" onClick={onZoomOut}><ZoomOut aria-hidden /></ControlButton>
			<ControlButton label="重置为 100%" onClick={onReset}><RotateCcw aria-hidden /></ControlButton>
			<ControlButton label={panLabel} onClick={onTogglePan} pressed={panEnabled}><Hand aria-hidden /></ControlButton>
			<span aria-live="polite" className="sr-only">缩放 {zoom}%</span>
		</>
	);
}

function ControlButton({ children, label, onClick, pressed }: {
	children: ReactElement;
	label: string;
	onClick: () => void;
	pressed?: boolean;
}): ReactElement {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button aria-label={label} aria-pressed={pressed} onClick={onClick} size="icon-xs" type="button" variant={pressed ? "default" : "ghost"}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent showArrow={false} side="top">{label}</TooltipContent>
		</Tooltip>
	);
}
