import { useCallback, useEffect, useState } from "react";
import type { PiAuthenticationMethod, PiAuthenticationStatus, PiOpenedSession, PiWorkspaceSnapshot } from "@shared/pi-contract";
import {
	cancelPiProviderLogin,
	choosePiWorkspace,
	continueRecentPiSession,
	createPiSession,
	inspectPiWorkspace,
	inspectPiAuthentication,
	loginPiProvider,
	openPiSession,
	readPiSessionTranscript,
	refreshPiWorkspaceResources,
} from "@view/lib/pi-client";
import { readDarkMode, setDarkMode } from "@view/lib/theme";
import {
	readShowThinking,
	saveShowThinking,
} from "./preferences/app-preferences";
import {
	MAX_RECENT_WORKSPACES,
	updateRecentWorkspaces,
} from "./preferences/recent-workspaces";

const RECENT_WORKSPACES_KEY = "oh-your-pi.recent-workspaces";

export type WorkspaceSessionController = {
	disabled: boolean;
	error?: string;
	isDarkMode: boolean;
	isNetworkOnline: boolean;
	onChooseWorkspace: () => Promise<void>;
	onContinueRecentSession: () => Promise<void>;
	onCreateSession: () => Promise<void>;
	onDarkModeChange: (value: boolean) => void;
	onCancelProviderLogin: (provider: string) => Promise<void>;
	onLoginProvider: (provider: string, authType: PiAuthenticationMethod) => Promise<void>;
	onRefreshSession: () => Promise<void>;
	onSelectSession: (sessionPath: string) => Promise<void>;
	onSelectWorkspace: (workspacePath: string) => Promise<void>;
	onSessionUpdate: (session: PiOpenedSession) => void;
	onShowThinkingChange: (value: boolean) => void;
	onStreamingChange: (isStreaming: boolean) => void;
	authentication?: PiAuthenticationStatus[];
	openedSession?: PiOpenedSession;
	recentWorkspaces: string[];
	showThinking: boolean;
	snapshot?: PiWorkspaceSnapshot;
};

export function useWorkspaceSessionController(): WorkspaceSessionController {
	const [workspacePath, setWorkspacePath] = useState("");
	const [authentication, setAuthentication] = useState<PiAuthenticationStatus[]>();
	const [snapshot, setSnapshot] = useState<PiWorkspaceSnapshot>();
	const [openedSession, setOpenedSession] = useState<PiOpenedSession>();
	const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
	const [error, setError] = useState<string>();
	const [isLoading, setIsLoading] = useState(false);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);
	const [showThinking, setShowThinking] = useState(false);
	const [isDarkMode, setIsDarkMode] = useState(readDarkMode);

	useEffect(() => {
		setRecentWorkspaces(readRecentWorkspaces());
		setShowThinking(readShowThinking());
		void refreshAuthentication().catch(() => undefined);
	}, []);

	useEffect(() => {
		function updateNetworkStatus(): void {
			setIsNetworkOnline(navigator.onLine);
		}

		window.addEventListener("online", updateNetworkStatus);
		window.addEventListener("offline", updateNetworkStatus);
		return () => {
			window.removeEventListener("online", updateNetworkStatus);
			window.removeEventListener("offline", updateNetworkStatus);
		};
	}, []);

	async function loadWorkspace(path: string): Promise<void> {
		const nextPath = path.trim();
		if (!nextPath) return;
		setError(undefined);
		setIsLoading(true);
		try {
			const nextSnapshot = await inspectPiWorkspace({
				workspacePath: nextPath,
			});
			const isSwitchingWorkspace =
				snapshot?.workspacePath !== undefined &&
				snapshot.workspacePath !== nextSnapshot.workspacePath;
			setWorkspacePath(nextSnapshot.workspacePath);
			setSnapshot(nextSnapshot);
			setRecentWorkspaces(saveRecentWorkspace(nextSnapshot.workspacePath));
			if (isSwitchingWorkspace) setOpenedSession(undefined);
			void refreshAuthentication().catch(() => undefined);
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法读取 Pi 工作区。"));
		} finally {
			setIsLoading(false);
		}
	}

	async function handleChooseWorkspace(): Promise<void> {
		setError(undefined);
		try {
			const { workspacePath: selectedPath } = await choosePiWorkspace();
			if (selectedPath) await loadWorkspace(selectedPath);
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法打开工作区选择器。"));
		}
	}

	async function handleSessionSelect(sessionPath: string): Promise<void> {
		if (!snapshot) return;
		setError(undefined);
		setIsLoading(true);
		try {
			setOpenedSession(
				await openPiSession({
					workspacePath: snapshot.workspacePath,
					sessionPath,
				}),
			);
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法打开 Pi 会话。"));
		} finally {
			setIsLoading(false);
		}
	}

	async function replaceSession(
		create: () => Promise<PiOpenedSession>,
	): Promise<void> {
		setError(undefined);
		setIsLoading(true);
		try {
			const [nextSession, nextSnapshot] = await Promise.all([
				create(),
				inspectPiWorkspace({
					workspacePath: snapshot?.workspacePath ?? workspacePath,
				}),
			]);
			setOpenedSession(nextSession);
			setSnapshot(nextSnapshot);
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法创建 Pi 会话。"));
		} finally {
			setIsLoading(false);
		}
	}

	async function handleCreateSession(): Promise<void> {
		if (!snapshot) return;
		await replaceSession(() =>
			createPiSession({ workspacePath: snapshot.workspacePath }),
		);
	}

	async function handleContinueRecentSession(): Promise<void> {
		if (!snapshot) return;
		await replaceSession(() =>
			continueRecentPiSession({ workspacePath: snapshot.workspacePath }),
		);
	}


	async function handleRefreshSession(): Promise<void> {
		if (!snapshot || !openedSession) return;
		const sessionPath = openedSession.runtime.sessionPath;
		const [transcript, nextSnapshot] = await Promise.all([
			readPiSessionTranscript({
				sessionPath,
				workspacePath: snapshot.workspacePath,
			}),
			inspectPiWorkspace({ workspacePath: snapshot.workspacePath }),
		]);
		setSnapshot(nextSnapshot);
		setOpenedSession((current) => {
			if (!current || current.runtime.sessionPath !== sessionPath)
				return current;
			return {
				...current,
				runtime: { ...current.runtime, isStreaming: false },
				transcript,
			};
		});
	}


	async function refreshAuthentication(): Promise<void> {
		setAuthentication(await inspectPiAuthentication());
	}

	async function handleCancelProviderLogin(provider: string): Promise<void> {
		await cancelPiProviderLogin({ provider });
	}

	async function handleLoginProvider(provider: string, authType: PiAuthenticationMethod): Promise<void> {
		if (isAuthenticating) return;
		setIsAuthenticating(true);
		setError(undefined);
		try {
			await loginPiProvider({ authType, provider });
			await refreshAuthentication();
			if (snapshot) {
				const refreshed = await refreshPiWorkspaceResources({ workspacePath: snapshot.workspacePath });
				setSnapshot(refreshed.snapshot);
				if (openedSession) {
					setOpenedSession(await openPiSession({
						sessionPath: openedSession.runtime.sessionPath,
						workspacePath: snapshot.workspacePath,
					}));
				}
			}
		} catch (requestError) {
			setError(toErrorMessage(requestError, "无法完成 Pi 提供商登录。"));
			throw requestError;
		} finally {
			setIsAuthenticating(false);
		}
	}

	const handleStreamingChange = useCallback((nextValue: boolean): void => {
		setOpenedSession((current) => {
			if (!current || current.runtime.isStreaming === nextValue) return current;
			return {
				...current,
				runtime: { ...current.runtime, isStreaming: nextValue },
			};
		});
	}, []);

	function handleShowThinkingChange(nextValue: boolean): void {
		setShowThinking(nextValue);
		saveShowThinking(nextValue);
	}

	function handleDarkModeChange(nextValue: boolean): void {
		setDarkMode(nextValue);
		setIsDarkMode(nextValue);
	}

	return {
		disabled: isLoading || isAuthenticating,
		error,
		isDarkMode,
		isNetworkOnline,
		onChooseWorkspace: handleChooseWorkspace,
		onContinueRecentSession: handleContinueRecentSession,
		onCreateSession: handleCreateSession,
		onDarkModeChange: handleDarkModeChange,
		onCancelProviderLogin: handleCancelProviderLogin,
		onLoginProvider: handleLoginProvider,
		onRefreshSession: handleRefreshSession,
		onSelectSession: handleSessionSelect,
		onSelectWorkspace: loadWorkspace,
		onSessionUpdate: setOpenedSession,
		onShowThinkingChange: handleShowThinkingChange,
		onStreamingChange: handleStreamingChange,
		openedSession,
		authentication,
		recentWorkspaces,
		showThinking,
		snapshot,
	};
}

function readRecentWorkspaces(): string[] {
	try {
		const stored = window.localStorage.getItem(RECENT_WORKSPACES_KEY);
		if (!stored) return [];
		const parsed: unknown = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(path): path is string => typeof path === "string" && path.length > 0,
			)
			.slice(0, MAX_RECENT_WORKSPACES);
	} catch {
		return [];
	}
}

function saveRecentWorkspace(workspacePath: string): string[] {
	const next = updateRecentWorkspaces(readRecentWorkspaces(), workspacePath);
	try {
		window.localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(next));
	} catch {
		return next;
	}
	return next;
}

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
