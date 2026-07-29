import { ImagePlus, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { type ReactElement } from "react";
import { PI_IMAGE_ATTACHMENT_LIMIT, type PiOpenedSession } from "@shared/pi-contract";
import type { ChatSession } from "@view/chat-store";
import { Button } from "@view/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@view/components/ui/tooltip";
import { AuthenticationDialogOpenAtom } from "@view/states/authentication.atom";
import { ModelThinkingSelector } from "./ModelThinkingSelector";

type ComposerToolbarProps = {
	attachmentCount: number;
	canCompose: boolean;
	canSend: boolean;
	hasAvailableCredential: boolean;
	hasAvailableModel: boolean;
	isAddingAttachments: boolean;
	isSending: boolean;
	isStreaming: boolean;
	onChooseAttachments: () => void;
	onFollowUp: () => Promise<void>;
	openedSession: PiOpenedSession;
	session: ChatSession;
	supportsImages: boolean;
};

export function ComposerToolbar({
	attachmentCount,
	canCompose,
	canSend,
	hasAvailableCredential,
	hasAvailableModel,
	isAddingAttachments,
	isSending,
	isStreaming,
	onChooseAttachments,
	onFollowUp,
	openedSession,
	session,
	supportsImages,
}: ComposerToolbarProps): ReactElement {
	const attachmentButtonDisabled = isSending
		|| isAddingAttachments
		|| !canCompose
		|| !supportsImages
		|| attachmentCount >= PI_IMAGE_ATTACHMENT_LIMIT;

	return (
		<div className="mt-2 flex items-center justify-between gap-3 px-0.5">
			<div className="flex min-w-0 items-center gap-2">
				<AttachmentEntry disabled={attachmentButtonDisabled} onChoose={onChooseAttachments} loading={isAddingAttachments} supports={supportsImages} />
				<ModelThinkingSelector isUpdating={isSending} openedSession={openedSession} session={session} />
			</div>
			<div className="flex items-center gap-2">
				{!hasAvailableCredential ? <AuthenticationEntry /> : (
					<>
						{isStreaming && (
							<Button
								disabled={isSending || !canSend}
								onClick={() => void onFollowUp()}
								size="sm"
								type="button"
								variant="outline"
							>
								排队后续
							</Button>
						)}
						<p className="text-xs text-muted-foreground">⌘/Ctrl + Enter 发送</p>
						<Button
							disabled={isSending || !hasAvailableModel || !canSend}
							size="sm"
							type="submit"
						>
							{isSending
								? <LoaderCircle aria-hidden className="animate-spin" data-icon="inline-start" />
								: <Send aria-hidden data-icon="inline-start" />}
							{isStreaming ? "插入指令" : "发送"}
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

export function AuthenticationEntry() {
	const setAuthenticationOpen = AuthenticationDialogOpenAtom.useChange();
	return (
		<Button onClick={() => setAuthenticationOpen(true)} size="sm" type="button">
			<ShieldCheck aria-hidden data-icon="inline-start" />
			连接模型提供商
		</Button>
	);
}

export function AttachmentEntry(props: {
	disabled?: boolean;
	onChoose: () => void;
	loading?: boolean;
	supports: boolean;
}) {
	const disabled = props.loading || props.disabled || !props.supports;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex">
					<Button
						aria-label="添加图片附件"
						disabled={disabled}
						onClick={props.onChoose}
						size="icon-sm"
						type="button"
						variant="outline"
					>
						{props.loading
							? <LoaderCircle aria-hidden className="animate-spin" />
							: <ImagePlus aria-hidden />}
					</Button>
				</span>
			</TooltipTrigger>
			<TooltipContent showArrow={false} side="top">
				{props.supports
					? `添加图片（最多 ${PI_IMAGE_ATTACHMENT_LIMIT} 张）`
					: "当前模型不支持图片输入"}
			</TooltipContent>
		</Tooltip>
	);
}
