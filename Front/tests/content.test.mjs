import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadArticles, validateArticle } from "../scripts/content.mjs";
import { renderMarkdown } from "../scripts/markdown.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nSAAAAAASUVORK5CYII=", "base64");
const article = (id = "a", content = { type: "markdown", path: `content/${id}/article.md` }) => ({
  id, date: "2026-12-01", title: "テスト記事", author: "著者", icon: `content/${id}/icon.png`, abstract: "**概要**です。", content,
});

async function fixture(value, body = "# 見出し\n本文") {
  const root = await mkdtemp(path.join(tmpdir(), "wathematica-content-"));
  const dir = path.join(root, "content", value.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "article.json"), JSON.stringify(value));
  await writeFile(path.join(dir, "icon.png"), png);
  if (value.content.type !== "external") await writeFile(path.join(dir, value.content.type === "pdf" ? "article.pdf" : "article.md"), body);
  return { root, dir };
}

test("loads the Bot schema for Markdown, PDF and external articles", async () => {
  const markdown = await fixture(article());
  const md = (await loadArticles(markdown.root, 2026)).articles[0];
  assert.match(md.abstract, /<strong>概要<\/strong>/);
  assert.match(md.body, /<h4 id="a-body-heading-1">見出し<\/h4>/);
  assert.ok(md.icon.startsWith("data:image/png;base64,"));
  const pdf = await fixture(article("pdf", { type: "pdf", path: "content/pdf/article.pdf" }), "%PDF-1.4\nfixture");
  assert.equal(Buffer.from((await loadArticles(pdf.root, 2026)).articles[0].body, "base64").toString(), "%PDF-1.4\nfixture");
  const external = await fixture(article("url", { type: "external", url: "https://example.com/article" }));
  assert.equal((await loadArticles(external.root, 2026)).articles[0].url, "https://example.com/article");
});

test("invalid metadata, URLs, signatures and missing files fail the build", async () => {
  assert.throws(() => validateArticle({ ...article(), date: "2026-02-30" }, "a"), /real YYYY-MM-DD/);
  assert.throws(() => validateArticle(article(), "other"), /match its article directory/);
  for (const url of ["javascript:alert(1)", "http://example.com", "https://user:password@example.com"]) {
    assert.throws(() => validateArticle(article("a", { type: "external", url }), "a"), /HTTPS/);
  }
  const invalidIcon = await fixture(article());
  await writeFile(path.join(invalidIcon.dir, "icon.png"), "not an image");
  await assert.rejects(loadArticles(invalidIcon.root, 2026), /Invalid PNG/);
  const invalidBody = await fixture(article("pdf", { type: "pdf", path: "content/pdf/article.pdf" }), "not a pdf");
  await assert.rejects(loadArticles(invalidBody.root, 2026), /Invalid PDF/);
  const missing = await fixture(article("a", { type: "markdown", path: "content/a/missing.md" }));
  await assert.rejects(loadArticles(missing.root, 2026), /ENOENT/);
  const invalidUtf8 = await fixture(article(), Buffer.from([255]));
  await assert.rejects(loadArticles(invalidUtf8.root, 2026), /encoded data/);
});

test("paths cannot escape their article directory, including through symlinks", async () => {
  for (const bodyPath of ["content/a/../other.md", "/etc/passwd.md", "content/b/article.md", "content/a/../../secret.md"]) {
    const value = article("a", { type: "markdown", path: bodyPath });
    const { root } = await fixture(value);
    await assert.rejects(loadArticles(root, 2026), /Invalid article path/);
  }
  const value = article("a", { type: "markdown", path: "content/a/link.md" });
  const { root, dir } = await fixture(value);
  await symlink(path.join(dir, "article.md"), path.join(dir, "link.md"));
  await assert.rejects(loadArticles(root, 2026), /Symlinks are not allowed/);
});

test("valid dates outside the selected advent season are omitted with a warning", async () => {
  const { root } = await fixture({ ...article(), date: "2025-12-01" });
  const result = await loadArticles(root, 2026);
  assert.equal(result.articles.length, 0);
  assert.equal(result.warnings.length, 1);
});

test("Markdown supports GFM while blocking raw HTML, active URLs and remote image requests", async () => {
  const html = await renderMarkdown(`
# 見出し
**太字**と[リンク](https://example.com)

- 項目
  - 入れ子

| A | B |
| --- | --- |
| 1 | 2 |

\`\`\`js
const x = "<script>";
\`\`\`

![外部画像](https://example.com/tracker.png)
![ローカル画像](image.png)
[危険](javascript:alert%281%29)
<script>alert(1)</script>
<img src="https://example.com/raw.png" onerror="alert(1)">
<iframe src="https://example.com"></iframe>
`, "safe-body");
  assert.match(html, /<strong>太字<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /(?:&lt;|&#x3C;)script>/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /画像: 外部画像/);
  assert.doesNotMatch(html, /<(?:script|img|iframe)\b|onerror=|href="javascript:|src="https:/i);
});
