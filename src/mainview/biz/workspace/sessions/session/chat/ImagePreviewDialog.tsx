import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, type ReactElement } from "react";
import { Button } from "@view/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@view/components/ui/dialog";

export type PreviewImage = {
	alt: string;
	src: string;
};

type ImagePreviewDialogProps = {
	activeIndex: number | null;
	images: readonly PreviewImage[];
	onActiveIndexChange: (index: number | null) => void;
};

export function ImagePreviewDialog({
	activeIndex,
	images,
	onActiveIndexChange,
}: ImagePreviewDialogProps): ReactElement {
	const currentIndex = activeIndex === null ? 0 : Math.min(activeIndex, images.length - 1);
	const current = images[currentIndex];

	function showOffset(offset: number): void {
		if (images.length < 2) return;
		onActiveIndexChange((currentIndex + offset + images.length) % images.length);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
		if (event.key === "ArrowLeft") showOffset(-1);
		else if (event.key === "ArrowRight") showOffset(1);
		else return;
		event.preventDefault();
	}

	function handleBackdropClick(event: MouseEvent<HTMLDivElement>): void {
		if (event.target === event.currentTarget) onActiveIndexChange(null);
	}

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) onActiveIndexChange(null);
			}}
			open={activeIndex !== null && current !== undefined}
		>
			<DialogContent
				className="inset-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black p-0 text-white ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
				onKeyDown={handleKeyDown}
				showCloseButton={false}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>图片预览</DialogTitle>
					<DialogDescription>
						{current ? `${current.alt}，第 ${currentIndex + 1} 张，共 ${images.length} 张` : "预览附件图片"}
					</DialogDescription>
				</DialogHeader>
				{current ? (
					<div
						className="relative flex size-full items-center justify-center overflow-hidden p-4 sm:p-8"
						onClick={handleBackdropClick}
					>
						<img
							alt={current.alt}
							className="max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-w-[calc(100vw-8rem)]"
							src={current.src}
						/>
						<p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
							{currentIndex + 1} / {images.length}
						</p>
						<DialogClose asChild>
							<Button
								aria-label="关闭图片预览"
								className="absolute right-4 top-4 rounded-full"
								size="icon-lg"
								type="button"
								variant="secondary"
							>
								<X aria-hidden />
							</Button>
						</DialogClose>
						{images.length > 1 ? (
							<>
								<Button
									aria-label="上一张图片"
									className="absolute left-4 rounded-full sm:left-8"
									onClick={() => showOffset(-1)}
									size="icon-lg"
									type="button"
									variant="secondary"
								>
									<ChevronLeft aria-hidden />
								</Button>
								<Button
									aria-label="下一张图片"
									className="absolute right-4 rounded-full sm:right-8"
									onClick={() => showOffset(1)}
									size="icon-lg"
									type="button"
									variant="secondary"
								>
									<ChevronRight aria-hidden />
								</Button>
							</>
						) : null}
						<p className="absolute inset-x-16 bottom-4 truncate text-center text-xs text-white/70">
							{current.alt}
						</p>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
