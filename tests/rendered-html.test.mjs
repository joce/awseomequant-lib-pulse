import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the completed library report", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Python Quant Library Pulse<\/title>/i);
  assert.match(html, /Showing[^<]*<!-- -->315/);
  assert.match(html, /Latest GitHub release/);
  assert.match(html, /Stars, high to low/);
  assert.doesNotMatch(html, /codex-preview|loading skeleton/i);
});

test("keeps the collected data internally consistent", async () => {
  const data = JSON.parse(
    await readFile(new URL("../app/libraries.json", import.meta.url), "utf8"),
  );
  assert.equal(data.libraries.length, 315);
  assert.equal(data.libraries.filter((row) => row.release).length, 176);
  const keys = data.libraries.map((row) => row.repo_requested || `${row.name}|${row.primary_url}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const row of data.libraries) {
    assert.ok(row.stars === null || (Number.isInteger(row.stars) && row.stars >= 0));
    if (row.release) {
      assert.ok(row.release.publishedAt);
      assert.ok(row.release.url.startsWith("https://github.com/"));
    }
  }
});
