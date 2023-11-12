import { exists, mkdir, readFile, writeFile } from "fs/promises";

import { plugin, type BunPlugin } from "bun";
import { CompileResult, compile } from "svelte/compiler";
import { join } from "path";

const CACHE_URI = new URL("../dist/assets", import.meta.url).pathname;

const module_map = new Map<string, string>();

async function writeCache(compileResult: CompileResult): Promise<void[]> {
	try {
		const cacheExists = await exists(CACHE_URI);
		if (!cacheExists) await mkdir(CACHE_URI, { recursive: true });

		const promises = [];

		const { js, css } = compileResult;

		if (css)
			promises.push(
				writeFile(
					join(CACHE_URI, "/app.css"),
					css.code + `\n/*# sourceMappingURL=${css.map.toUrl()}*/` || ""
				)
			);

		if (js) {
			let output = `import { mount } from "svelte"`;
			output += js.code.replace("export default", "window.App =");
			output +=
				`
mount(window.App, {
	target: document.body,
	intro: true,
	props: window.Props || {},
	context: window.Context || {},
});
` +
				`\n//# sourceMappingURL=data:application/json;base64,${btoa(
					js.map.toString()
				)}`;
			promises.push(writeFile(join(CACHE_URI, "/app.js"), output));
		}
		return Promise.all(promises);
	} catch (error) {
		throw Error("Failed to write client output", { cause: error });
	}
}

const svelteLoader: BunPlugin = {
	name: "Svelte loader",
	setup(build) {
		build.onLoad({ filter: /\.svelte$/ }, async (args) => {
			if (module_map.has(args.path))
				return {
					contents: module_map.get(args.path) as string,
					loader: "js",
					resolveDir: args.path,
				};

			const source = await readFile(args.path);

			// Write client output
			const clientOutput = compile(source.toString(), {
				discloseVersion: false,
				filename: args.path,
				css: "external",
				generate: "client",
				runes: true,
			});
			await writeCache(clientOutput);

			// Return server output
			const { js } = compile(source.toString(), {
				discloseVersion: false,
				filename: args.path,
				css: "external",
				generate: "server",
				runes: true,
			});

			const contents =
				js.code +
				`\n//# sourceMappingURL=data:application/json;base64,${btoa(
					js.map.toString()
				)}`;

			module_map.set(args.path, contents);
			return { contents, loader: "js", resolveDir: args.path };
		});
	},
};

plugin(svelteLoader);
