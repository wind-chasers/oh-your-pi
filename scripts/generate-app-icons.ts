import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { Logo } from "../src/mainview/logo";

const projectRoot = resolve(import.meta.dir, "..");
const sourcePath = resolve(projectRoot, "src/mainview/logo.tsx");
const assetsDirectory = resolve(projectRoot, "assets");
const iconsetDirectory = resolve(assetsDirectory, "icon.iconset");

const CANVAS_SIZE = 1024;
const LOGO_SIZE = 584;
const LOGO_OFFSET = (CANVAS_SIZE - LOGO_SIZE) / 2;

const iconsetFiles = [
	[16, "icon_16x16.png"],
	[32, "icon_16x16@2x.png"],
	[32, "icon_32x32.png"],
	[64, "icon_32x32@2x.png"],
	[128, "icon_128x128.png"],
	[256, "icon_128x128@2x.png"],
	[256, "icon_256x256.png"],
	[512, "icon_256x256@2x.png"],
	[512, "icon_512x512.png"],
	[1024, "icon_512x512@2x.png"],
] as const;

const icoSizes = [16, 32, 48, 256] as const;

function createIconSvg(sourceSvg: string): string {
	const encodedLogo = Buffer.from(sourceSvg).toString("base64");

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <rect x="40" y="40" width="944" height="944" rx="212" fill="#FAFAFA"/>
  <rect x="44" y="44" width="936" height="936" rx="208" fill="none" stroke="#000000" stroke-opacity="0.08" stroke-width="8"/>
  <image href="data:image/svg+xml;base64,${encodedLogo}" x="${LOGO_OFFSET}" y="${LOGO_OFFSET}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
}

async function renderPng(iconSvg: string, size: number): Promise<Buffer> {
	return sharp(Buffer.from(iconSvg))
		.resize(size, size)
		.png({ compressionLevel: 9 })
		.toBuffer();
}

function createIco(images: ReadonlyArray<{ size: number; png: Buffer }>): Buffer {
	const headerSize = 6;
	const entrySize = 16;
	const directory = Buffer.alloc(headerSize + entrySize * images.length);
	directory.writeUInt16LE(0, 0);
	directory.writeUInt16LE(1, 2);
	directory.writeUInt16LE(images.length, 4);

	let imageOffset = directory.length;
	for (const [index, image] of images.entries()) {
		const entryOffset = headerSize + index * entrySize;
		directory.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset);
		directory.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1);
		directory.writeUInt8(0, entryOffset + 2);
		directory.writeUInt8(0, entryOffset + 3);
		directory.writeUInt16LE(1, entryOffset + 4);
		directory.writeUInt16LE(32, entryOffset + 6);
		directory.writeUInt32LE(image.png.length, entryOffset + 8);
		directory.writeUInt32LE(imageOffset, entryOffset + 12);
		imageOffset += image.png.length;
	}

	return Buffer.concat([directory, ...images.map(({ png }) => png)]);
}

const sourceSvg = renderToStaticMarkup(createElement(Logo, { mode: "light" }));
const iconSvg = createIconSvg(sourceSvg);

await mkdir(iconsetDirectory, { recursive: true });
await writeFile(resolve(assetsDirectory, "app-icon.svg"), iconSvg);

await Promise.all(
	iconsetFiles.map(async ([size, filename]) => {
		await writeFile(resolve(iconsetDirectory, filename), await renderPng(iconSvg, size));
	}),
);

await writeFile(
	resolve(assetsDirectory, "app-icon.png"),
	await renderPng(iconSvg, CANVAS_SIZE),
);

const icoImages = await Promise.all(
	icoSizes.map(async (size) => ({ size, png: await renderPng(iconSvg, size) })),
);
await writeFile(resolve(assetsDirectory, "app-icon.ico"), createIco(icoImages));

console.log(`Generated application icons from ${sourcePath}`);
