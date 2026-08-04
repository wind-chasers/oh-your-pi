import type { RegisteredEditorExtension } from "../framework";
import { commandExtension } from "./commands";
import { fileExtension } from "./filemention";
import { skillExtension } from "./skill";

export interface EditorExtensionRegistry {
	byTrigger: ReadonlyMap<string, RegisteredEditorExtension>;
}

export function createEditorExtensionRegistry(
	extensions: readonly RegisteredEditorExtension[],
): EditorExtensionRegistry {
	const ids = new Set<string>();
	const byTrigger = new Map<string, RegisteredEditorExtension>();
	for (const extension of extensions) {
		if (ids.has(extension.id)) {
			throw new Error(`Duplicate editor extension id: ${extension.id}`);
		}
		ids.add(extension.id);
		for (const trigger of extension.triggers) {
			if (trigger.length !== 1) {
				throw new Error(`Editor extension trigger must be one character: ${trigger}`);
			}
			if (byTrigger.has(trigger)) {
				throw new Error(`Duplicate editor extension trigger: ${trigger}`);
			}
			byTrigger.set(trigger, extension);
		}
	}
	return { byTrigger };
}

export const chatExtensionRegistry = createEditorExtensionRegistry([
	fileExtension,
	skillExtension,
	commandExtension,
]);

export const editExtensionRegistry = createEditorExtensionRegistry([
	fileExtension,
	skillExtension,
]);

