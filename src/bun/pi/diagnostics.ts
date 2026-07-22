import { stat } from "node:fs/promises";
import { redactSensitiveText } from "./redaction";

const PROXY_ENVIRONMENT_VARIABLES = [
	"ALL_PROXY",
	"HTTP_PROXY",
	"HTTPS_PROXY",
	"NO_PROXY",
	"NODE_EXTRA_CA_CERTS",
	"NODE_TLS_REJECT_UNAUTHORIZED",
] as const;

export type AuthFileMetadata = {
	exists: boolean;
	mtimeMs: number | null;
	size: number | null;
};

export type RuntimeDiagnosticInput = {
	authError?: unknown;
	authFileBefore?: AuthFileMetadata;
	authStatus: "error" | "missing" | "resolved" | "unknown";
	modelId: string | null;
	provider: string | null;
	sessionPath: string | null;
	workspacePath: string | null;
};

export async function readAuthFileMetadata(authPath: string): Promise<AuthFileMetadata> {
	try {
		const metadata = await stat(authPath);
		return { exists: metadata.isFile(), mtimeMs: metadata.isFile() ? metadata.mtimeMs : null, size: metadata.isFile() ? metadata.size : null };
	} catch {
		return { exists: false, mtimeMs: null, size: null };
	}
}

export function isOAuthResolutionFailure(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /OAuth (auth derivation|refresh) failed/i.test(message);
}

export function toRuntimeDiagnostic(input: RuntimeDiagnosticInput & {
	agentDir: string;
	authFileAfter: AuthFileMetadata;
}): Record<string, unknown> {
	const authFileChanged = input.authFileBefore
		? input.authFileBefore.mtimeMs !== input.authFileAfter.mtimeMs || input.authFileBefore.size !== input.authFileAfter.size
		: false;
	const errorMessage = errorToMessage(input.authError);

	return {
		capturedAt: new Date().toISOString(),
		backend: {
			bunVersion: Bun.version,
			pid: process.pid,
			revision: "oauth-diagnostics-v1",
			workingDirectory: process.cwd(),
		},
		workspacePath: input.workspacePath,
		agentDir: input.agentDir,
		sessionPath: input.sessionPath,
		provider: input.provider,
		modelId: input.modelId,
		auth: {
			status: input.authStatus,
			errorMessage: errorMessage ? redactSensitiveText(errorMessage) : null,
			causeMessage: redactOptionalMessage(errorToCauseMessage(input.authError)),
			authFile: input.authFileAfter,
			authFileChanged,
			presentEnvironmentVariables: PROXY_ENVIRONMENT_VARIABLES.filter((name) => Boolean(process.env[name])),
		},
	};
}

function redactOptionalMessage(message: string | null): string | null {
	return message ? redactSensitiveText(message) : null;
}

function errorToMessage(error: unknown): string | null {
	if (error instanceof Error) return error.message;
	return error ? String(error) : null;
}

function errorToCauseMessage(error: unknown): string | null {
	if (!(error instanceof Error) || !error.cause) return null;
	return errorToMessage(error.cause);
}
