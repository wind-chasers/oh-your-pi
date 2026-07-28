export function redactSensitiveText(text: string): string {
	return text
		.replace(/\b(Bearer\s+)[^\s"']+/gi, "$1[已隐藏]")
		.replace(/\bsk-[A-Za-z0-9_-]{8,}/gi, "[已隐藏]")
		.replace(/\b((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,"'}]+/gi, "$1[已隐藏]");
}
