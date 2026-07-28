import type { ReactElement, SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & {
	mode?: "light" | "dark";
};

export function Logo({ mode = "light", ...svgProps }: LogoProps): ReactElement {
	const foregroundColor = mode === "dark" ? "white" : "black";

	return (
		<svg
			fill="none"
			height="470"
			viewBox="0 0 470 470"
			width="470"
			xmlns="http://www.w3.org/2000/svg"
			{...svgProps}
		>
			<path
				clipRule="evenodd"
				d="M0 0H352.07V234.71H234.71V352.07H117.36V469.43H0V0ZM117.36 117.36V234.71H234.71V117.36H117.36Z"
				fill={foregroundColor}
				fillRule="evenodd"
			/>
			<path
				d="M352.07 234.71H469.43V469.43H352.07V234.71Z"
				fill="#0ABD57"
			/>
		</svg>
	);
}
