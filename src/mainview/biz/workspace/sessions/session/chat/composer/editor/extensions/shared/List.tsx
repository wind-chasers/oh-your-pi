import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Button } from "@view/components/ui/button";

interface ExtensionListProps<TItem> {
	activeIndex: number;
	empty: ReactNode;
	getKey: (item: TItem) => string;
	items: readonly TItem[];
	onHover: (index: number) => void;
	onSelect: (item: TItem) => void;
	renderItem: (item: TItem) => ReactNode;
}

export function ExtensionList<TItem>({
	activeIndex,
	empty,
	getKey,
	items,
	onHover,
	onSelect,
	renderItem,
}: ExtensionListProps<TItem>): ReactElement {
	const options = useRef<Array<HTMLButtonElement | null>>([]);

	useEffect(() => {
		options.current[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, items]);

	if (items.length === 0) return <>{empty}</>;
	return (
		<div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
			{items.map((item, index) => (
				<Button
					className="w-full justify-start font-normal data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
					data-active={index === activeIndex}
					key={getKey(item)}
					onClick={() => onSelect(item)}
					onMouseEnter={() => onHover(index)}
					onPointerDown={(event) => event.preventDefault()}
					ref={(option) => {
						options.current[index] = option;
					}}
					size="sm"
					type="button"
					variant="ghost"
				>
					{renderItem(item)}
				</Button>
			))}
		</div>
	);
}
