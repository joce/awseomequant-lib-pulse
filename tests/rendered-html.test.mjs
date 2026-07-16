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
  assert.match(html, /Hide crypto-only/);
  assert.match(html, /Crypto-only/);
  assert.doesNotMatch(html, /codex-preview|loading skeleton/i);
});

test("keeps the collected data internally consistent", async () => {
  const [data, cryptoOnly] = await Promise.all([
    readFile(new URL("../app/libraries.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/crypto-only.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.equal(data.libraries.length, 315);
  assert.equal(data.libraries.filter((row) => row.release).length, 176);
  const keys = data.libraries.map((row) => row.repo_requested || `${row.name}|${row.primary_url}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(cryptoOnly.length, 21);
  assert.equal(new Set(cryptoOnly).size, cryptoOnly.length);
  assert.ok(cryptoOnly.includes("freqtrade/freqtrade"));
  assert.ok(cryptoOnly.includes("ccxt/ccxt"));
  assert.ok(!cryptoOnly.includes("Lumiwealth/lumibot"));
  const repos = new Set(data.libraries.map((row) => row.repo).filter(Boolean));
  assert.ok(cryptoOnly.every((repo) => repos.has(repo)));
  for (const row of data.libraries) {
    assert.ok(row.stars === null || (Number.isInteger(row.stars) && row.stars >= 0));
    if (row.release) {
      assert.ok(row.release.publishedAt);
      assert.ok(row.release.url.startsWith("https://github.com/"));
    }
  }
});
