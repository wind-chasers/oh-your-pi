import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { LANGUAGE_LOADERS, resolveCodeLanguage, type SupportedLanguage } from "./syntax-languages";

const MAX_HIGHLIGHT_CHARACTERS = 200_000;
const MAX_HIGHLIGHT_LINE_LENGTH = 10_000;

export type HighlightedCodeResult = {
	tokens: Array<Array<{
		content: string;
		htmlStyle?: Record<string, string>;
	}>>;
};

const loadingLanguages = new Map<SupportedLanguage, Promise<void>>();
let highlighterPromise: ReturnType<typeof createHighlighterCore> | undefined;

export async function highlightCode(
	code: string,
	language?: string,
	signal?: AbortSignal
): Promise<HighlightedCodeResult | undefined> {
	const resolvedLanguage = resolveCodeLanguage(language);
	if (!resolvedLanguage || code.length > MAX_HIGHLIGHT_CHARACTERS) return undefined;
	await loadLanguage(resolvedLanguage);
	const highlighter = await getHighlighter();
	if (signal?.aborted) return;
	return highlighter.codeToTokens(code, {
		lang: resolvedLanguage,
		themes: {
			light: "github-light",
			dark: "github-dark",
		},
		defaultColor: false,
		tokenizeMaxLineLength: MAX_HIGHLIGHT_LINE_LENGTH,
	});
}

function getHighlighter() {
	highlighterPromise ??= createHighlighterCore({
		engine: createJavaScriptRegexEngine(),
		langs: [],
		themes: [
			import("@shikijs/themes/github-light"),
			import("@shikijs/themes/github-dark"),
		],
	});
	return highlighterPromise;
}

async function loadLanguage(language: SupportedLanguage): Promise<void> {
	const highlighter = await getHighlighter();
	if (highlighter.getLoadedLanguages().includes(language)) return;
	const pending = loadingLanguages.get(language);
	if (pending) return pending;
	const loading = highlighter.loadLanguage(LANGUAGE_LOADERS[language]())
		.finally(() => loadingLanguages.delete(language));
	loadingLanguages.set(language, loading);
	await loading;
}
