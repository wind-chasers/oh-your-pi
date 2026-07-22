import type { AgentSession } from "@earendil-works/pi-coding-agent";

type PromptSession = Pick<AgentSession, "prompt">;

export async function startSessionPrompt(
	session: PromptSession,
	text: string,
	onError: (error: unknown) => void,
): Promise<void> {
	const { promise: accepted, reject, resolve } = Promise.withResolvers<void>();
	void session.prompt(text, {
		preflightResult: (success) => {
			if (success) resolve();
			else reject(new Error("Pi 未接受这条消息。"));
		},
	}).catch((error: unknown) => {
		onError(error);
		reject(error);
	});
	await accepted;
}
