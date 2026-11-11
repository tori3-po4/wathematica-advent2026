import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import config from "../site.config.json" with { type: "json" };

test("static HTML hydrates React using local assets and valid CSP hashes", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const csp = /http-equiv="content-security-policy" content="([^"]+)"/i.exec(html)?.[1];
  assert.ok(csp, "Run npm run build before npm test");
  assert.ok(csp.includes("connect-src 'none'"));
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  assert.match(csp, /img-src data:/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  for (const [, style] of styles) assert.ok(csp.includes(`'sha256-${createHash("sha256").update(style).digest("base64")}'`));
  for (const [, attributes, code] of scripts) {
    if (/\bsrc=/.test(attributes)) continue;
    assert.ok(csp.includes(`'sha256-${createHash("sha256").update(code).digest("base64")}'`));
  }
  assert.equal([...html.matchAll(/class="day-tag/g)].length, 25);
  const { year } = config;
  assert.equal([...html.matchAll(/class="calendar-blank"/g)].length, new Date(Date.UTC(year, 11, 1)).getUTCDay());
  assert.match(html, /<astro-island\b[^>]*client="load"/);
  assert.doesNotMatch(html, /id="calendar-data"|data-article=|(?:src|href)="[^"<>]*\/content\//);
  const assetUrls = [...html.matchAll(/(?:component-url|renderer-url|src|href)="(\/_astro\/[^"#]+)"/g)].map((match) => match[1]);
  assert.ok(assetUrls.some((url) => url.endsWith(".js")));
  assert.ok(assetUrls.some((url) => url.endsWith(".css")));
  for (const url of new Set(assetUrls)) {
    assert.ok((await readFile(new URL(`../dist${url}`, import.meta.url))).length > 0, `${url} exists`);
  }
  assert.doesNotMatch(html, /<(?:script|img|iframe)[^>]+src="https?:|<link[^>]+href="https?:/);
  assert.doesNotMatch(html, /@import|url\(["']?https?:/);
});
