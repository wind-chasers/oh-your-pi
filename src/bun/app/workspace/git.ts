import type {
	PiWorkspaceGit,
	PiWorkspaceGitBranchRequest,
} from "@shared/pi-contract";

type GitCommandResult = {
	exitCode: number;
	stderr: string;
	stdout: string;
};

export async function inspectWorkspaceGit(
	workspacePath: string,
): Promise<PiWorkspaceGit | null> {
	const repository = await runGit(workspacePath, ["rev-parse", "--is-inside-work-tree"]);
	if (!repository || repository.exitCode !== 0 || repository.stdout.trim() !== "true") return null;

	const [currentBranch, branches] = await Promise.all([
		runGit(workspacePath, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
		runGit(workspacePath, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]),
	]);
	if (!branches || branches.exitCode !== 0) {
		throw new Error("无法读取 Git 分支。");
	}

	return {
		branches: branches.stdout.split("\n").filter(Boolean),
		currentBranch:
			currentBranch && currentBranch.exitCode === 0
				? currentBranch.stdout.trim() || null
				: null,
	};
}

export async function switchWorkspaceGitBranch(
	input: PiWorkspaceGitBranchRequest,
): Promise<PiWorkspaceGit> {
	const branch = input.branch.trim();
	const repository = await inspectWorkspaceGit(input.workspacePath);
	if (!repository) throw new Error("当前工作区不是 Git 仓库。");
	if (!branch || !repository.branches.includes(branch)) {
		throw new Error("要切换的 Git 分支不存在。");
	}

	const result = await runGit(input.workspacePath, ["switch", "--", branch]);
	if (!result || result.exitCode !== 0) {
		throw new Error(result?.stderr.trim() || "无法切换 Git 分支。");
	}

	const nextRepository = await inspectWorkspaceGit(input.workspacePath);
	if (!nextRepository) throw new Error("切换后无法读取 Git 仓库。");
	return nextRepository;
}

async function runGit(
	workspacePath: string,
	args: string[],
): Promise<GitCommandResult | undefined> {
	try {
		const process = Bun.spawn(["git", "-C", workspacePath, ...args], {
			stderr: "pipe",
			stdout: "pipe",
		});
		const [exitCode, stderr, stdout] = await Promise.all([
			process.exited,
			new Response(process.stderr).text(),
			new Response(process.stdout).text(),
		]);
		return { exitCode, stderr, stdout };
	} catch {
		return undefined;
	}
}
