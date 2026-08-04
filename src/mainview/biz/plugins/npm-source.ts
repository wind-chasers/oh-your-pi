const NPM_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[a-z0-9*._~^<>=|\-]+)?$/i;

export function parseNpmPluginSource(value: string): string | undefined {
	const input = value.trim();
	const copiedSource = input.match(/^pi\s+install\s+(.+)$/i)?.[1]?.trim() ?? input;
	if (copiedSource.startsWith("npm:")) {
		const packageName = copiedSource.slice(4).trim();
		return NPM_NAME.test(packageName) ? `npm:${packageName}` : undefined;
	}
	return NPM_NAME.test(copiedSource) ? `npm:${copiedSource}` : undefined;
}
