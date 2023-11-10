import { readFile } from "node:fs/promises";
import { createRequire, Module } from "node:module";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";

import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { render } from "svelte/server";

import { buildClient, buildSsr } from "./esbuild.js";

async function renderApp(props) {
	try {
		const stdin = `import { mount } from "svelte";
		import App from "./app.svelte";
		mount(App, {
			target: document.body,
			intro: true,
			props: ${JSON.stringify(props)}
		});
		`;
		await buildClient(stdin);

		const build = await buildSsr();
		const require = createRequire("/dummy/");
		const module = new Module(randomUUID());

		const context = { console, module, require };
		runInNewContext(build.outputFiles[0]?.text, context, "app.js");

		const { default: App } = module.exports;

		let { html, head } = render(App, { props });

		head = `<link rel="stylesheet" href="/app.css" />
		<script type="module" src="/app.js"></script>
		${head}
		`;

		return { html, head };
	} catch (e) {
		// node:vm throws a ReferenceError when the script fails to run
		// Hono does not catch this error, so we need to throw it ourselves
		throw Error(e);
	}
}

const app = new Hono();
const view = await readFile("index.html", "utf-8");

app.use("*", logger());
app.use("*", serveStatic({ root: "./public" }));

app.get("/", async (c) => {
	const { html, head } = await renderApp({ name: "World" });
	const page = view
		.replace("<!--SSR-HEAD-->", head)
		.replace("<!--SSR-HTML-->", html);
	return c.html(page);
});

app.get("/api/name", async (c) => {
	const api = await fetch("https://api.namefake.com/").then((res) =>
		res.json()
	);
	c.header("Cache-Control", "public, max-age=60, immutable");
	return c.json(api);
});

serve(
	{
		fetch: app.fetch,
		hostname: "localhost",
		port: 3000,
	},
	(info) => {
		console.log(`Listening on ${info.address}:${info.port}`);
	}
);
