import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";

import { compileSvelte, renderSSR as render } from "./render.js";

const app = new Hono();
const view = await readFile("index.html", "utf-8");
await compileSvelte(resolve("src/app.svelte"));

app.use("*", logger());
app.use("/client/*", serveStatic({ root: ".cache" }));

app.get("/", async (c) => {
	const name = c.req.query("name") || "World";

	let { html, head } = await render({ name });

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

export default app;
