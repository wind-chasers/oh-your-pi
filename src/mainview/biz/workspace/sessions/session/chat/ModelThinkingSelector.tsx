import { type ReactElement } from "react";
import type { PiOpenedSession, ThinkingLevel } from "@shared/pi-contract";
import type { ChatSession } from "@view/chat-store";
import { AuthenticationAtom } from "@view/states/authentication.atom";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@view/components/ui/select";

type ModelThinkingSelectorProps = {
	isUpdating: boolean;
	openedSession: PiOpenedSession;
	session: ChatSession;
};

export function ModelThinkingSelector({
	isUpdating,
	openedSession,
	session,
}: ModelThinkingSelectorProps): ReactElement | null {
	const authentication = AuthenticationAtom.useData() ?? [];
	const { availableThinkingLevels, isStreaming, model, models, thinkingLevel } =
		openedSession.runtime;
	const availableModels = models.filter((candidate) =>
		authentication.some(
			(provider) =>
				provider.provider === candidate.provider && provider.status === "available",
		),
	);
	const isLocked = isStreaming || isUpdating;
	const selectedModelValue =
		model &&
		availableModels.some(
			(candidate) =>
				candidate.provider === model.provider && candidate.id === model.id,
		)
			? modelValue(model.provider, model.id)
			: undefined;

	function handleModelChange(value: string): void {
		const [provider, modelId] = value.split("\u0000");
		if (!provider || !modelId) return;
		void session.setModel(provider, modelId).catch(() => undefined);
	}

	function handleThinkingChange(value: string): void {
		void session.setThinking(value as ThinkingLevel).catch(() => undefined);
	}

	if (availableModels.length === 0 && availableThinkingLevels.length === 0) {
		return null;
	}

	return (
		<div className="flex min-w-0 items-center gap-2">
			{availableModels.length > 0 ? (
				<Select
					disabled={isLocked}
					onValueChange={handleModelChange}
					value={selectedModelValue}
				>
					<SelectTrigger aria-label="模型" className="max-w-48" size="sm">
						<SelectValue placeholder="选择模型" />
					</SelectTrigger>
					<SelectContent className="min-w-max" position="popper">
						<SelectGroup>
							{availableModels.map((candidate) => (
								<SelectItem
									key={modelValue(candidate.provider, candidate.id)}
									value={modelValue(candidate.provider, candidate.id)}
								>
									{candidate.name} · {candidate.provider}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			) : null}
			{availableThinkingLevels.length > 0 ? (
				<Select
					disabled={isLocked}
					onValueChange={handleThinkingChange}
					value={thinkingLevel}
				>
					<SelectTrigger aria-label="思考级别" size="sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent position="popper">
						<SelectGroup>
							{availableThinkingLevels.map((level) => (
								<SelectItem key={level} value={level}>
									{level}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			) : null}
		</div>
	);
}

function modelValue(provider: string, modelId: string): string {
	return `${provider}\u0000${modelId}`;
}
