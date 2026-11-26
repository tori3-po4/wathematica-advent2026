import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import config from "../site.config.json" with { type: "json" };

// 生成物の契約を検証するため、実行前にnpm run buildが必要。
// ソースの設定だけでなく、配信するHTMLが静的アセット・外部通信の制約を満たすか確認する。
test("static HTML hydrates React using local assets", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
    .catch(() => assert.fail("Run npm run build before npm test"));
  assert.equal([...html.matchAll(/class="day-tag/g)].length, 25);
  const { year } = config;
  assert.equal([...html.matchAll(/class="calendar-blank"/g)].length, new Date(Date.UTC(year, 11, 1)).getUTCDay());
  assert.match(html, /<astro-island\b[^>]*client="load"/);
  // 元の記事ファイルを別途参照せず、Reactのpropsと埋め込みデータで表示を完結させる。
  assert.doesNotMatch(html, /id="calendar-data"|data-article=|(?:src|href)="[^"<>]*\/content\//);
  // BASE_PATHを指定したビルドでは、アセットのURLにも同じサブパスが付く。
  const base = (process.env.BASE_PATH || "").replace(/\/+$/, "");
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const assetPattern = new RegExp(`(?:component-url|renderer-url|src|href)="${escapedBase}(\\/_astro\\/[^"#]+)"`, "g");
  const assetUrls = [...html.matchAll(assetPattern)].map((match) => match[1]);
  assert.ok(assetUrls.some((url) => url.endsWith(".js")));
  assert.ok(assetUrls.some((url) => url.endsWith(".css")));
  for (const url of new Set(assetUrls)) {
    assert.ok((await readFile(new URL(`../dist${url}`, import.meta.url))).length > 0, `${url} exists`);
  }
  // サブパス以外から始まる/_astro/への参照が残っていると、公開先で404になる。
  if (base) assert.doesNotMatch(html, /(?:component-url|renderer-url|src|href)="\/_astro\//);
  // 外部記事への通常のリンクは許可する一方、自動取得される外部リソースは含めない。
  assert.doesNotMatch(html, /<(?:script|img|iframe)[^>]+src="https?:|<link[^>]+href="https?:/);
  assert.doesNotMatch(html, /@import|url\(["']?https?:/);
});
