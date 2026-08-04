import { ExternalLink, LoaderCircle, Plus } from "lucide-react";
import { type ReactElement, useState } from "react";
import type { PiPluginScope } from "@shared/pi-contract";
import { Button } from "@view/components/ui/button";
import { Input } from "@view/components/ui/input";
import { openPiPackages } from "@view/lib/pi-client";
import { parseNpmPluginSource } from "./npm-source";

type AddPluginPaneProps = {
	busy: boolean;
	workspaceAvailable: boolean;
	install: (source: string, scope: PiPluginScope) => Promise<boolean>;
};

const INVALID_NPM_SOURCE = "请输入 npm package，例如 xxxx、npm:xxxx、@aaaa/bbbb，或从官网复制完整安装命令。";

export function AddPluginPane({ busy, workspaceAvailable, install }: AddPluginPaneProps): ReactElement {
	const [source, setSource] = useState("");
	const [error, setError] = useState<string>();

	function changeSource(value: string): void {
		setSource(value);
		setError(value.trim() && !parseNpmPluginSource(value) ? INVALID_NPM_SOURCE : undefined);
	}

	async function installTo(scope: PiPluginScope): Promise<void> {
		const packageSource = parseNpmPluginSource(source);
		if (!packageSource) {
			setError(INVALID_NPM_SOURCE);
			return;
		}
		setError(undefined);
		if (await install(packageSource, scope)) setSource("");
	}

	return (
		<section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-7 py-8">
			<div>
				<h2 className="text-lg font-medium">添加插件</h2>
				<p className="mt-1 text-sm text-muted-foreground">从 Pi 官方包目录搜索插件，复制安装命令后粘贴到这里。</p>
				<Button className="mt-2 px-0" onClick={() => void openPiPackages()} size="sm" type="button" variant="link">
					Pi 官方包目录
					<ExternalLink aria-hidden data-icon="inline-end" />
				</Button>
			</div>
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-2">
					<label className="text-sm font-medium" htmlFor="plugin-source">npm package</label>
					<Input
						autoComplete="off"
						disabled={busy}
						id="plugin-source"
						onChange={(event) => changeSource(event.target.value)}
						placeholder="pi install npm:@vigolium/piolium"
						value={source}
					/>
					<p className="text-xs text-muted-foreground">
						可粘贴 <code className="font-mono border mx-0.5 px-0.5  rounded">pi install npm:package</code>，或省略前面的
						<code className="font-mono border mx-0.5 px-0.5 rounded">pi install npm:</code> 前缀
					</p>
					{error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
				</div>
				<div className="flex flex-wrap gap-2">
					<Button disabled={busy} onClick={() => void installTo("global")} type="button">
						{busy ? <LoaderCircle aria-hidden className="animate-spin" data-icon="inline-start" /> : <Plus aria-hidden data-icon="inline-start" />}
						安装到全局
					</Button>
					<Button disabled={busy || !workspaceAvailable} onClick={() => void installTo("workspace")} type="button" variant="outline">
						<Plus aria-hidden data-icon="inline-start" />
						安装到工作区
					</Button>
				</div>
				{!workspaceAvailable ? <p className="text-xs text-muted-foreground">选择工作区后可安装工作区插件。</p> : null}
			</div>
		</section>
	);
}
