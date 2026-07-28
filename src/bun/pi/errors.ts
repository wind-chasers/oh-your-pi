export type PiErrorCode =
	| "authentication-resolution-failed"
	| "session-closed"
	| "session-not-persisted"
	| "unknown";

export class PiError extends Error {
	constructor(
		readonly code: PiErrorCode,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "PiError";
	}
}

export function classifyPiError(error: unknown): PiErrorCode {
	if (error instanceof PiError) return error.code;
	const message = error instanceof Error ? error.message : String(error);
	if (/OAuth (auth derivation|refresh) failed/i.test(message)) return "authentication-resolution-failed";
	return "unknown";
}

export function toError(error: unknown, fallback: string): Error {
	return error instanceof Error ? error : new Error(fallback);
}
