import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BunPlugin } from "bun";
import type { ElectrobunConfig } from "electrobun";
import packageJson from "./package.json";

const aliasDirectories = {
	"@main": resolve(import.meta.dirname, "src/bun"),
	"@shared": resolve(import.meta.dirname, "src/shared"),
	"@view": resolve(import.meta.dirname, "src/mainview"),
} as const;

const resolvableExtensions = [".ts", ".tsx", ".js", ".jsx", ".json"];

const appVersion = process.env.OH_YOUR_PI_VERSION ?? packageJson.version;

function resolveProjectAlias(importPath: string): string | undefined {
	const [alias, ...segments] = importPath.split("/");
	const directory = aliasDirectories[alias as keyof typeof aliasDirectories];
	if (!directory) return;

	const sourcePath = resolve(directory, ...segments);
	if (existsSync(sourcePath) && statSync(sourcePath).isFile()) return sourcePath;

	for (const extension of resolvableExtensions) {
		const sourceFile = `${sourcePath}${extension}`;
		if (existsSync(sourceFile)) return sourceFile;
	}

	if (!existsSync(sourcePath) || !statSync(sourcePath).isDirectory()) return;
	for (const extension of resolvableExtensions) {
		const indexFile = join(sourcePath, `index${extension}`);
		if (existsSync(indexFile)) return indexFile;
	}
}

const pathAliasPlugin: BunPlugin = {
	name: "project-path-aliases",
	setup(build) {
		build.onResolve({ filter: /^@(main|shared|view)(?:\/|$)/ }, ({ path }) => {
			const resolvedPath = resolveProjectAlias(path);
			return resolvedPath ? { path: resolvedPath } : undefined;
		});
	},
};

export default {
	app: {
		name: "Oh Your Pi",
		identifier: "com.ohyourpi.app",
		version: appVersion,
		description: "本机 Pi Coding Agent 图形客户端",
	},
	build: {
		bun: {
			plugins: [pathAliasPlugin],
		},
		// Vite builds to dist/, we copy from there.
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
		},
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately.
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
			icons: "assets/icon.iconset",
			codesign: process.env.OH_YOUR_PI_CODESIGN === "true",
			notarize: process.env.OH_YOUR_PI_NOTARIZE === "true",
		},
		linux: {
			bundleCEF: false,
			icon: "assets/app-icon.png",
		},
		win: {
			bundleCEF: false,
			icon: "assets/app-icon.ico",
		},
	},
	release: {
		baseUrl: process.env.OH_YOUR_PI_UPDATE_BASE_URL,
		generatePatch: true,
	},
	runtime: {
		exitOnLastWindowClosed: process.platform !== "darwin",
	},
} satisfies ElectrobunConfig;
