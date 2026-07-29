import { useState } from "react";

const ZOOM_STEP = 5;
const MIN_ZOOM = 25;
const MAX_ZOOM = 300;

export type MermaidOffset = {
	x: number;
	y: number;
};

export type MermaidViewport = {
	offset: MermaidOffset;
	onOffsetChange: (offset: MermaidOffset) => void;
	panEnabled: boolean;
	scale: number;
};

type MermaidViewportState = {
	panEnabled: boolean;
	reset: () => void;
	togglePan: () => void;
	viewport: MermaidViewport;
	zoom: number;
	zoomIn: () => void;
	zoomOut: () => void;
};

export function useMermaidViewport(): MermaidViewportState {
	const [zoom, setZoom] = useState(100);
	const [offset, setOffset] = useState<MermaidOffset>({ x: 0, y: 0 });
	const [panEnabled, setPanEnabled] = useState(false);

	function changeOffset(nextOffset: MermaidOffset): void {
		setOffset(nextOffset);
	}

	function zoomIn(): void {
		setZoom((current) => Math.min(current + ZOOM_STEP, MAX_ZOOM));
	}

	function zoomOut(): void {
		setZoom((current) => Math.max(current - ZOOM_STEP, MIN_ZOOM));
	}

	function reset(): void {
		setZoom(100);
		setOffset({ x: 0, y: 0 });
	}

	function togglePan(): void {
		setPanEnabled((current) => !current);
	}

	return {
		panEnabled,
		reset,
		togglePan,
		viewport: { offset, onOffsetChange: changeOffset, panEnabled, scale: zoom / 100 },
		zoom,
		zoomIn,
		zoomOut,
	};
}
