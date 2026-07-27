import { type ReactElement, useState } from "react";
import type { PiOpenedSession, PiThinkingLevel } from "@shared/pi-contract";
import {
	setPiSessionModel,
	setPiSessionThinking,
} from "@view/lib/pi-client";
import { AuthenticationAtom } from "@view/states/authentication.atom";
import { OpenedSessionAtom } from "@view/states/current.atom";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@view/components/ui/select";


export function ModelThinkingSelector(): ReactElement | null {
	const authentication = AuthenticationAtom.useData() ?? [];
	const [openedSession, setOpenedSession] = OpenedSessionAtom.use();
	const [error, setError] = useState<string>();
	const [isUpdating, setIsUpdating] = useState(false);
	if (!openedSession) return null;
	const { availableThinkingLevels, isStreaming, model, models, sessionPath, thinkingLevel } =
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

	async function update(
		action: () => Promise<PiOpenedSession>,
		fallback: string,
	): Promise<void> {
		setError(undefined);
		setIsUpdating(true);
		try {
			setOpenedSession(await action());
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : fallback);
		} finally {
			setIsUpdating(false);
		}
	}

	function handleModelChange(value: string): void {
		const [provider, modelId] = value.split("\u0000");
		if (!provider || !modelId) return;
		void update(
			() => setPiSessionModel({ modelId, provider, sessionPath }),
			"无法切换 Pi 模型。",
		);
	}

	function handleThinkingChange(value: string): void {
		void update(
			() =>
				setPiSessionThinking({
					sessionPath,
					thinkingLevel: value as PiThinkingLevel,
				}),
			"无法更新思考级别。",
		);
	}


	if (availableModels.length === 0 && availableThinkingLevels.length === 0)
		return null;

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
			{error ? <p className="max-w-48 text-xs text-destructive" role="alert">{error}</p> : null}
		</div>
	);
}

function modelValue(provider: string, modelId: string): string {
	return `${provider}\u0000${modelId}`;
}
