import { readFile } from "node:fs/promises";
import { createRequire, Module } from "node:module";
import { Script } from "node:vm";

import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { render } from "svelte/server";

import { buildClient, buildSsr } from "./esbuild.js";

async function renderApp(props) {
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
	const app = new Script(build.outputFiles[0].text);
	const require = createRequire(import.meta.url);
	const module = new Module(import.meta.url);

	const context = { console, module, require };
	app.runInNewContext(context);

	const { default: App } = module.exports;

	let { html, head } = render(App, { props });

	head = `<link rel="stylesheet" href="/app.css" />
	<script type="module" src="/app.js"></script>
	${head}
	`;

	return { html, head };
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

serve({ fetch: app.fetch, hostname: "localhost", port: 3000 }, (info) => {
	console.log(`Listening on ${info.address}:${info.port}`);
});
