import { type ReactElement } from "react";
import type { PiModel, PiOpenedSession, ThinkingLevel } from "@shared/pi-contract";
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
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@view/components/ui/hover-card";

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
	const authentication = AuthenticationAtom.useValue() ?? [];
	const { availableThinkingLevels, isStreaming, model, models, thinkingLevel } =
		openedSession.runtime;
	const availableModels = models.filter((candidate) =>
		authentication.some(
			(provider) =>
				provider.provider === candidate.provider && provider.status === "available",
		),
	);
	const isLocked = isStreaming || isUpdating;
	const selectedModel = model
		? availableModels.find(
				(candidate) =>
					candidate.provider === model.provider && candidate.id === model.id,
			)
		: undefined;
	const selectedModelValue = selectedModel
		? modelValue(selectedModel.provider, selectedModel.id)
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
					<HoverCard closeDelay={120} openDelay={150}>
						<HoverCardTrigger asChild>
							<SelectTrigger
								aria-label="模型"
								indicator="none"
								size="sm"
							>
								<SelectValue placeholder="选择模型">
									{selectedModel?.name}
								</SelectValue>
							</SelectTrigger>
						</HoverCardTrigger>
						{selectedModel ? <ModelHoverCard model={selectedModel} /> : null}
					</HoverCard>
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
					<SelectTrigger aria-label="思考级别" indicator="none" size="sm">
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

function ModelHoverCard({ model }: { model: PiModel }): ReactElement {
	return (
		<HoverCardContent align="start" className="w-64" side="top">
			<div className="flex flex-col gap-1.5">
				<p className="font-medium">{model.name}</p>
				<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
					<dt className="text-muted-foreground">提供商</dt>
					<dd>{model.provider}</dd>
					<dt className="text-muted-foreground">上下文窗口</dt>
					<dd>{model.contextWindow.toLocaleString("zh-CN")} tokens</dd>
					<dt className="text-muted-foreground">图像</dt>
					<dd>{supportLabel(model.input.includes("image"))}</dd>
					<dt className="text-muted-foreground">推理</dt>
					<dd>{supportLabel(model.reasoning)}</dd>
				</dl>
			</div>
		</HoverCardContent>
	);
}

function supportLabel(isSupported: boolean): string {
	return isSupported ? "支持" : "不支持";
}

function modelValue(provider: string, modelId: string): string {
	return `${provider}\u0000${modelId}`;
}
