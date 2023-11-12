import { readFile } from "node:fs/promises";

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { render } from "svelte/server";

import { default as App } from "./app.svelte";

const app = new Hono();
const view = await readFile("index.html", "utf-8");

app.use("*", logger());
app.use("/assets/*", serveStatic({ root: "./dist" }));

app.get("/", async (c) => {
	const name = c.req.query("name") || "World";

	// @ts-expect-error - This will not be properly typed
	let { html, head } = render(App, { props: { name } });

	head += `<script>window.Props = ${JSON.stringify({ name })};
	window.Context = ${JSON.stringify({})};</script>`;

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

console.log("Server setup in", Bun.nanoseconds() / 1e6, "ms");
export default app;
