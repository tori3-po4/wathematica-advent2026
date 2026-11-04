import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("production HTML embeds working CSP hashes, calendar alignment and all runtime assets", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
  assert.ok(csp, "Run npm run build before npm test");
  assert.ok(csp.includes("connect-src 'none'"));
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  for (const [, style] of styles) assert.ok(csp.includes(`'sha256-${createHash("sha256").update(style).digest("base64")}'`));
  for (const [, attributes, code] of scripts) {
    assert.doesNotMatch(attributes, /\bsrc=/);
    if (attributes.includes('type="application/json"')) { JSON.parse(code); continue; }
    assert.ok(csp.includes(`'sha256-${createHash("sha256").update(code).digest("base64")}'`));
    new vm.Script(code);
    assert.doesNotMatch(code, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\s*\(|\bimport\s*\(/);
  }
  assert.equal([...html.matchAll(/class="day-tag/g)].length, 25);
  const { year } = JSON.parse(/<script id="calendar-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal([...html.matchAll(/class="calendar-blank"/g)].length, new Date(Date.UTC(year, 11, 1)).getUTCDay());
  assert.doesNotMatch(html, /<(?:script|img|iframe)[^>]+src="(?:https?:|\/)|<link[^>]+rel="(?:stylesheet|preload|prefetch|preconnect|dns-prefetch)"/);
  assert.doesNotMatch(html, /@import|url\(["']?https?:/);
});
