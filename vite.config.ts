import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), react()],
	resolve: {
		alias: {
			"@main": fileURLToPath(new URL("./src/bun", import.meta.url)),
			"@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
			"@view": fileURLToPath(new URL("./src/mainview", import.meta.url)),
		},
	},
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
