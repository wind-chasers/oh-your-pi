import {
	type HTMLAttributes,
	type ReactElement,
	type ReactNode,
	useLayoutEffect,
	useRef,
} from "react";

export const CHAT_SCROLL_CONTAINER_CLASS = "chat-scroll-container";

const DISARM_BUFFER_MS = 120;
const BOTTOM_PIN_TOLERANCE_PX = 2;

type AnimatedHeightProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
	children: ReactNode;
	duration?: number;
	isLive?: boolean;
};

export function AnimatedHeight({
	children,
	className,
	duration = 200,
	isLive = false,
	...props
}: AnimatedHeightProps): ReactElement {
	const outerRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const durationRef = useRef(duration);
	const isLiveRef = useRef(isLive);
	durationRef.current = duration;
	isLiveRef.current = isLive;

	useLayoutEffect(() => {
		const outer = outerRef.current;
		const inner = innerRef.current;
		if (!outer || !inner || typeof ResizeObserver === "undefined") return;

		let initialized = false;
		let animationFrame = 0;

		function startAnchorLoop(updateScrollPosition: () => void): void {
			cancelAnimationFrame(animationFrame);
			const deadline = performance.now() + durationRef.current + DISARM_BUFFER_MS;
			function tick(): void {
				if (performance.now() >= deadline) {
					animationFrame = 0;
					return;
				}
				updateScrollPosition();
				animationFrame = requestAnimationFrame(tick);
			}
			animationFrame = requestAnimationFrame(tick);
		}

		const resizeObserver = new ResizeObserver(() => {
			const nextHeight = `${inner.offsetHeight}px`;
			if (outer.style.height === nextHeight) return;

			const scrollContainer = outer.closest(`.${CHAT_SCROLL_CONTAINER_CLASS}`) as HTMLElement | null;
			if (!initialized || isLiveRef.current || !scrollContainer) {
				outer.style.height = nextHeight;
				initialized = true;
				return;
			}

			const anchorTop = outer.getBoundingClientRect().top;
			const distanceFromBottom = scrollContainer.scrollHeight
				- scrollContainer.scrollTop
				- scrollContainer.clientHeight;
			const keepBottomPinned = distanceFromBottom <= BOTTOM_PIN_TOLERANCE_PX;
			outer.style.height = nextHeight;
			startAnchorLoop(() => {
				if (keepBottomPinned) {
					scrollContainer.scrollTop = scrollContainer.scrollHeight
						- scrollContainer.clientHeight
						- distanceFromBottom;
					return;
				}
				const delta = outer.getBoundingClientRect().top - anchorTop;
				if (delta !== 0) scrollContainer.scrollTop += delta;
			});
			initialized = true;
		});

		resizeObserver.observe(inner);
		return () => {
			resizeObserver.disconnect();
			cancelAnimationFrame(animationFrame);
		};
	}, []);

	return (
		<div
			{...props}
			className={className}
			ref={outerRef}
			style={{ boxSizing: "content-box", height: 0, overflow: "hidden" }}
			data-testid="tool-section"
		>
			<div ref={innerRef}>{children}</div>
		</div>
	);
}
