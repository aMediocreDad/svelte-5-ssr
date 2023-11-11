import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";

import { renderSvelte } from "./scripts/render.js";

const app = new Hono();
const view = await readFile("index.html", "utf-8");

app.use("*", logger());
app.use("*", serveStatic({ root: "./public" }));

app.get("/", async (c) => {
	const name = c.req.query("name") || "World";

	let { html, head } = await renderSvelte({
		file: resolve("src/app.svelte"),
		props: { name },
	});

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
