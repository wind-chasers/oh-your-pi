import type { ReactElement } from "react";
import type { PiPlugin, PiPluginScope } from "@shared/pi-contract";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@view/components/ui/alert-dialog";

type RemovePluginDialogProps = {
	busy: boolean;
	plugin: PiPlugin | undefined;
	onOpenChange: (open: boolean) => void;
	onRemove: (source: string, scope: PiPluginScope) => void;
};

export function RemovePluginDialog({ busy, plugin, onOpenChange, onRemove }: RemovePluginDialogProps): ReactElement {
	return (
		<AlertDialog onOpenChange={onOpenChange} open={Boolean(plugin)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>移除这个插件？</AlertDialogTitle>
					<AlertDialogDescription>
						将卸载 <code className="font-mono text-foreground">{plugin?.source}</code>，其提供的资源将不再可用。
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
					<AlertDialogAction disabled={busy} onClick={() => plugin && onRemove(plugin.source, plugin.scope)} variant="destructive">
						移除
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
