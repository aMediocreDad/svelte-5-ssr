import { build as esBuild } from "esbuild";
import sveltePlugin from "esbuild-svelte";

const config = {
	entryPoints: ["src/app.svelte"],
	platform: "node",
	format: "cjs",
	bundle: true,
	write: false,
	plugins: [
		sveltePlugin({
			compilerOptions: {
				runes: true,
				generate: "server",
				css: "injected",
			},
		}),
	],
};

const clientConfig = {
	platform: "browser",
	format: "esm",
	outdir: "public",
	bundle: true,
	write: true,
	entryNames: "app",
	plugins: [
		sveltePlugin({
			compilerOptions: {
				runes: true,
				generate: "client",
				css: "external",
			},
		}),
	],
};

export const buildSsr = async () => esBuild(config);
export const buildClient = async (string) =>
	esBuild({
		...clientConfig,
		stdin: {
			contents: string,
			sourcefile: "app.js",
			resolveDir: "./src",
			loader: "js",
		},
	});
