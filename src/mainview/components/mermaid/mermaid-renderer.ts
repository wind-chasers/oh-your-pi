import type mermaid from "mermaid";

type Mermaid = typeof mermaid;

let mermaidPromise: Promise<Mermaid> | undefined;

export async function renderMermaidDiagram(id: string, source: string, dark: boolean): Promise<string> {
	const renderer = await loadMermaid();
	renderer.initialize({
		darkMode: dark,
		flowchart: { useMaxWidth: false },
		fontFamily: "Geist Variable, sans-serif",
		fontSize: 13,
		htmlLabels: false,
		securityLevel: "strict",
		secure: ["dompurifyConfig", "htmlLabels", "securityLevel", "startOnLoad", "theme", "themeVariables"],
		startOnLoad: false,
		theme: dark ? "dark" : "default",
		themeVariables: { fontSize: "13px" },
	});
	const { svg } = await renderer.render(id, source);
	return svg;
}

function loadMermaid(): Promise<Mermaid> {
	mermaidPromise ??= import("mermaid").then(({ default: mermaid }) => mermaid);
	return mermaidPromise;
}
