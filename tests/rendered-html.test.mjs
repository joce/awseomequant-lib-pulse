import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

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
  const text = html.replaceAll("<!-- -->", "");
  assert.match(html, /<title>Awesome Quant · Library pulse<\/title>/i);
  assert.match(html, /<h1>Awesome Quant · Library pulse<\/h1>/i);
  assert.match(html, /href="https:\/\/github\.com\/wilsonfreitas\/awesome-quant\/blob\/main\/README\.md"[^>]*>Awesome Quant README<\/a>/i);
  const data = await readFile(new URL("../app/libraries.json", import.meta.url), "utf8").then(JSON.parse);
  assert.match(text, new RegExp(`Checked against GitHub on ${date.format(new Date(data.as_of))}`));
  assert.doesNotMatch(html, /class="eyebrow"/i);
  assert.match(html, /Showing[^<]*<!-- -->461/);
  assert.match(html, /Latest GitHub release/);
  assert.match(html, /Languages/);
  assert.match(html, /Categories/);
  assert.match(html, /aria-sort="descending"/);
  assert.match(html, /Hide crypto-only/);
  assert.match(html, /Hide archived/);
  assert.match(html, /Crypto-only/);
  assert.match(html, /Archived/);
  assert.match(html, /archive-tag/);
  assert.doesNotMatch(html, /codex-preview|loading skeleton/i);
});

test("keeps the collected data internally consistent", async () => {
  const [data, cryptoOnly] = await Promise.all([
    readFile(new URL("../app/libraries.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/crypto-only.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.equal(data.libraries.length, 461);
  assert.equal(data.libraries.filter((row) => row.release).length, 249);
  const keys = data.libraries.map((row) => row.repo_requested || `${row.name}|${row.primary_url}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(cryptoOnly.length, 29);
  assert.equal(new Set(cryptoOnly).size, cryptoOnly.length);
  assert.ok(cryptoOnly.includes("freqtrade/freqtrade"));
  assert.ok(cryptoOnly.includes("ccxt/ccxt"));
  assert.ok(cryptoOnly.includes("stellar-deprecated/kelp"));
  assert.ok(!cryptoOnly.includes("Lumiwealth/lumibot"));
  const repos = new Set(data.libraries.map((row) => row.repo).filter(Boolean));
  assert.ok(cryptoOnly.every((repo) => repos.has(repo)));
  for (const row of data.libraries) {
    assert.ok(row.languages.length > 0);
    assert.ok(row.stars === null || (Number.isInteger(row.stars) && row.stars >= 0));
    if (row.release) {
      assert.ok(row.release.publishedAt);
      assert.ok(row.release.url.startsWith("https://github.com/"));
    }
  }
});
