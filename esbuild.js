import { build as esBuild } from "esbuild";
import sveltePlugin from "esbuild-svelte";

export const buildSsr = async () =>
	esBuild({
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
	});

export const buildClient = async (contents) =>
	esBuild({
		stdin: {
			contents,
			sourcefile: "app.js",
			resolveDir: "./src",
			loader: "js",
		},
		entryNames: "app",
		platform: "browser",
		format: "esm",
		outdir: "public",
		bundle: true,
		write: true,
		plugins: [
			sveltePlugin({
				compilerOptions: {
					runes: true,
					generate: "client",
					css: "external",
				},
			}),
		],
	});
