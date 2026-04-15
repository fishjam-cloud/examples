import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { workletInline } from "./vite-plugin-worklet";

export default defineConfig({
	root: "src",
	plugins: [tailwindcss(), solidPlugin(), workletInline()],
	build: {
		target: "esnext",
		rollupOptions: {
			input: {
				index: resolve(__dirname, "src/index.html"),
			},
		},
	},
	server: {
		hmr: false,
	},
	optimizeDeps: {
		exclude: ["@libav.js/variant-opus-af"],
	},
});
