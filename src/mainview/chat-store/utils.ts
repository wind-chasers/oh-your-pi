import {
	PI_IMAGE_ATTACHMENT_LIMIT,
	type PiImageAttachmentSource,
	type PiOpenedSession,
	type PiSessionRuntimeState,
} from "@shared/pi-contract";

export function assertOpenedSessionIdentity(
	openedSession: PiOpenedSession,
	workspacePath: string,
	sessionId: string,
	sessionPath: string,
): void {
	if (openedSession.runtime.sessionId !== sessionId
		|| openedSession.transcript.session.id !== sessionId) {
		throw new Error(`主进程返回了错误的会话 ID：${openedSession.runtime.sessionId}`);
	}
	if (openedSession.runtime.sessionPath !== sessionPath
		|| openedSession.transcript.session.path !== sessionPath) {
		throw new Error(`主进程返回了错误的会话路径：${openedSession.runtime.sessionPath}`);
	}
	if (openedSession.transcript.session.workspacePath !== workspacePath) {
		throw new Error(`会话 ${sessionId} 不属于工作区 ${workspacePath}`);
	}
}

export function withRuntime(
	openedSession: PiOpenedSession,
	patch: Partial<PiSessionRuntimeState>,
): PiOpenedSession {
	return {
		...openedSession,
		runtime: { ...openedSession.runtime, ...patch },
	};
}

export function haveSameDependencies(
	left: readonly unknown[],
	right: readonly unknown[],
): boolean {
	return left.length === right.length
		&& left.every((dependency, index) => Object.is(dependency, right[index]));
}

export function normalizePromptInput(
	text: string,
	images: readonly PiImageAttachmentSource[],
): { text: string; images: PiImageAttachmentSource[] } {
	const normalizedText = text.trim();
	if (!normalizedText && images.length === 0) throw new Error("消息不能为空。");
	if (images.length > PI_IMAGE_ATTACHMENT_LIMIT) {
		throw new Error(`每条消息最多附加 ${PI_IMAGE_ATTACHMENT_LIMIT} 张图片。`);
	}
	const paths = new Set<string>();
	const normalizedImages = images.map((image): PiImageAttachmentSource => {
		if (image.type === "data") {
			if (!image.data || !image.mimeType.startsWith("image/") || !image.name.trim()) {
				throw new Error("剪贴板图片数据无效。");
			}
			return { ...image, name: image.name.trim() };
		}
		const path = requireValue(image.path, "图片路径");
		if (paths.has(path)) throw new Error("不能重复附加同一张图片。");
		paths.add(path);
		return { type: "path", path };
	});
	return { text: normalizedText, images: normalizedImages };
}

export function requireValue(value: string, name: string): string {
	if (!value.trim()) throw new Error(`${name} 不能为空。`);
	return value;
}

export function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
