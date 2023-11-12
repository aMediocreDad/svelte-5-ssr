import { exists, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { CompileResult, compile } from "svelte/compiler";
import { render } from "svelte/server";

const DEFAULTS = {
	css: "external",
	discloseVersion: false,
	runes: true,
};

const SSR_DEFAULTS = {
	...DEFAULTS,
	generate: "server",
};

const CLIENT_DEFAULTS = {
	...DEFAULTS,
	generate: "client",
};

const CACHE_URI = new URL("../.cache", import.meta.url).pathname;

async function resetCache() {
	try {
		const cacheExists = await exists(CACHE_URI);
		if (cacheExists) await rm(CACHE_URI, { recursive: true });
		await mkdir(join(CACHE_URI, "/client"), { recursive: true });
	} catch (error) {
		throw Error("Failed to reset cache", { cause: error });
	}
}

interface WriteCacheData {
	clientOutput: CompileResult;
	serverOutput: CompileResult;
}
async function writeCache({
	clientOutput,
	serverOutput,
}: WriteCacheData): Promise<void[]> {
	try {
		await resetCache();

		const promises = [];

		if (serverOutput.css)
			promises.push(
				writeFile(join(CACHE_URI, "/app-server.css"), serverOutput.css.code, {})
			);
		if (serverOutput.js)
			promises.push(
				writeFile(join(CACHE_URI, "/app-server.js"), serverOutput.js.code)
			);
		if (clientOutput.css)
			promises.push(
				writeFile(
					join(CACHE_URI, "/client/app-client.css"),
					clientOutput.css.code
				)
			);

		if (clientOutput.js) {
			let js = `import { mount } from "svelte"`;
			js += clientOutput.js.code.replace("export default", "window.App =");
			js += `
mount(window.App, {
	target: document.body,
	intro: true,
	props: window.Props || {},
	context: window.Context || {},
});
`;
			promises.push(writeFile(join(CACHE_URI, "/client/app-client.js"), js));
		}
		return Promise.all(promises);
	} catch (error) {
		throw Error("Failed to write client output", { cause: error });
	}
}

interface CompileSvelteOptions {
	/** Write client output to public/app.js */
	writeClient?: boolean;
	/** Compiler options for the client */
	clientCompilerOptions?: any;
	/** Compiler options for the server */
	serverCompilerOptions?: any;
}

export async function compileSvelte(
	file: string,
	options: CompileSvelteOptions = {}
) {
	if (!file) throw Error("Missing file");
	const clientOptions = options.clientCompilerOptions || {};
	const serverOptions = options.serverCompilerOptions || {};

	let server: CompileResult, client: CompileResult;
	try {
		const code = await readFile(file, "utf-8");
		server = compile(code, { ...SSR_DEFAULTS, ...serverOptions });
		client = compile(code, {
			...CLIENT_DEFAULTS,
			...clientOptions,
		});
	} catch (e) {
		// Normalize Error types to avoid serializing issues
		throw Error("Failed to compile Svelte file", { cause: e });
	}

	await writeCache({
		clientOutput: client,
		serverOutput: server,
	});

	return {
		/** Server Output */
		server,
		/** Client Output */
		client,
	};
}

export async function renderSSR(props?: any, context?: any) {
	try {
		const css = readFile(join(CACHE_URI, "/app-server.css"), "utf-8").catch(
			() => null
		);
		//@ts-ignore - This is a file that possibly doesn't exist
		const { default: App } = await import(join(CACHE_URI, "/app-server.js"));
		let { html, head } = render(App, { props, context });

		if (props || context)
			head += `<script>window.Props = ${JSON.stringify(props)};
window.Context = ${JSON.stringify(context)};</script>`;
		if (css) head += `<style>${css}</style>`;

		return { head, html };
	} catch (error) {
		throw Error("Failed to render SSR", { cause: error });
	}
}
