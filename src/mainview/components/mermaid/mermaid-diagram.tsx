import { type PointerEvent, type ReactElement, useEffect, useId, useRef, useState } from "react";
import { cn } from "@view/lib/utils";
import type { MermaidOffset, MermaidViewport } from "./use-mermaid-viewport";
import { renderMermaidDiagram } from "./mermaid-renderer";
import { LimitQueue } from "@view/lib/limit-queue";

const limiter = new LimitQueue(1, 'macro');
const NOOP = () => {};

type MermaidRenderState =
	| { status: "loading" }
	| { status: "rendered"; svg: string }
	| { status: "error" };

type MermaidDiagramProps = {
	code: string;
	inverted?: boolean;
	viewport?: MermaidViewport;
};

type PanStart = MermaidOffset & {
	pointerId: number;
	startX: number;
	startY: number;
};

const DEFAULT_OFFSET: MermaidOffset = { x: 0, y: 0 };

export function MermaidDiagram({ code, inverted = false, viewport }: MermaidDiagramProps): ReactElement {
	const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "-");
	const canvasRef = useRef<HTMLDivElement | null>(null);
	const panStartRef = useRef<PanStart | undefined>(undefined);
	const liveOffsetRef = useRef<MermaidOffset>(DEFAULT_OFFSET);
	const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
	const [renderState, setRenderState] = useState<MermaidRenderState>({ status: "loading" });
	const renderDark = inverted ? !dark : dark;

	useEffect(() => {
		const root = document.documentElement;
		function updateTheme(): void {
			setDark(root.classList.contains("dark"));
		}
		updateTheme();
		const observer = new MutationObserver(updateTheme);
		observer.observe(root, { attributeFilter: ["class"], attributes: true });
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		setRenderState({ status: "loading" });
		const task = limiter.run(async (signal) => {
			try {
				const svg = await renderMermaidDiagram(`mermaid-${instanceId}`, code, renderDark, signal);
				if (signal.aborted) return;
				setRenderState({ status: "rendered", svg });
			} catch (error) {
				if (signal.aborted) return;
				setRenderState({ status: "error" });
			}
		});

		task.catch(NOOP);
		return () => { task.cancel() };
	}, [code, instanceId, renderDark]);

	const offset = viewport?.offset ?? DEFAULT_OFFSET;
	const scale = viewport?.scale ?? 1;
	const panEnabled = viewport?.panEnabled ?? false;

	useEffect(() => {
		liveOffsetRef.current = offset;
	}, [offset]);

	function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
		if (!panEnabled || !viewport) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		const start = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: offset.x, y: offset.y };
		panStartRef.current = start;
		liveOffsetRef.current = offset;
	}

	function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
		const start = panStartRef.current;
		if (!start || start.pointerId !== event.pointerId) return;
		const nextOffset = { x: start.x + event.clientX - start.startX, y: start.y + event.clientY - start.startY };
		liveOffsetRef.current = nextOffset;
		canvasRef.current?.style.setProperty("transform", getCanvasTransform(nextOffset, scale));
	}

	function handlePointerEnd(event: PointerEvent<HTMLDivElement>): void {
		const start = panStartRef.current;
		if (!start || start.pointerId !== event.pointerId) return;
		panStartRef.current = undefined;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
		const offset = liveOffsetRef.current;
		if (offset.x !== start.x || offset.y !== start.y) viewport?.onOffsetChange(offset);
	}
	return (
		<div className="min-h-26 overflow-auto p-4" data-slot="mermaid-diagram">
			{renderState.status === "loading" ? <p className="m-0 text-[0.875em] text-muted-foreground">正在生成图表…</p> : null}
			{renderState.status === "error" ? (
				<p className="m-0 text-[0.875em] text-destructive" role="alert">图表语法无效，无法渲染。</p>
			) : null}
			{renderState.status === "rendered" ? (
				<div
					ref={canvasRef}
					className={cn(
						"min-w-full w-max origin-top transition-transform duration-150 ease-out [&_svg]:mx-auto [&_svg]:block",
						panEnabled && "cursor-grab touch-none select-none active:cursor-grabbing active:transition-none",
					)}
					onPointerCancel={handlePointerEnd}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerEnd}
					style={{ transform: getCanvasTransform(offset, scale) }}
					dangerouslySetInnerHTML={{ __html: renderState.svg }}
				/>
			) : null}
		</div>
	);
}

function getCanvasTransform(offset: MermaidOffset, scale: number): string {
	return `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
}
