import { readFile, writeFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";

import { compile } from "svelte/compiler";
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

const imports = new Map();

async function linker(specifier, referencingModule) {
	if (imports.has(specifier)) return imports.get(specifier);

	const mod = await import(specifier);
	const exportNames = Object.keys(mod);
	const imported = new SyntheticModule(
		exportNames,
		() => {
			exportNames.forEach((key) => imported.setExport(key, mod[key]));
		},
		{ identifier: specifier, context: referencingModule.context }
	);

	imports.set(specifier, imported);
	return imported;
}

async function renderSSR(ssrOutput, props, context) {
	const module = new SourceTextModule(ssrOutput.js.code, {
		identifier: "app.js",
		importModuleDynamically: linker,
	});

	await module.link(linker);
	await module.evaluate();

	const App = module.namespace.default;

	let { html, head } = render(App, { props, context });

	if (props || context)
		head += `<script>window.Props = ${JSON.stringify(props)};
window.Context = ${JSON.stringify(context)};</script>`;
	if (ssrOutput.css) head += `<style>${ssrOutput.css.code}</style>`;

	return { head, html };
}

async function writeClient(clientOutput) {
	try {
		if (clientOutput.css)
			await writeFile("public/app.css", clientOutput.css.code);

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
			await writeFile("public/app.js", js);
		}
	} catch (error) {
		throw Error("Failed to write client output", { cause: error });
	}
}

export async function compileSvelte(file, options = {}) {
	if (!file) throw Error("Missing file");
	const clientOptions = options.clientCompilerOptions || {};
	const serverOptions = options.serverCompilerOptions || {};

	try {
		const code = await readFile(file, "utf-8");
		const server = await compile(code, { ...SSR_DEFAULTS, ...serverOptions });
		const client = await compile(code, {
			...CLIENT_DEFAULTS,
			...clientOptions,
		});

		if (options.writeClient)
			await writeClient(client, options.props, options.context);

		return {
			server,
			client,
			/** Renders server output */
			render: (props, context) => renderSSR(server, props, context),
		};
	} catch (e) {
		// Normalize Error types to avoid serializing issues
		throw Error(e);
	}
}
