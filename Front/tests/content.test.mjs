import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadArticles, validateArticle } from "../scripts/content.mjs";
import { renderMarkdown } from "../scripts/markdown.mjs";

// 外部データに依存しない最小のPNGとBot形式のメタデータを、各テストの起点にする。
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nSAAAAAASUVORK5CYII=", "base64");
const article = (id = "a", content = { type: "markdown", path: `content/${id}/article.md` }) => ({
  id, date: "2026-12-01", title: "テスト記事", author: "著者", icon: `content/${id}/icon.png`, abstract: "**概要**です。", content,
});

/** 毎回別の一時フォルダに投稿一式を作り、破損・パス改変のテストが実記事へ影響しないようにする。 */
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
  assert.equal(md.icon, `data:image/png;base64,${png.toString("base64")}`);
  const pdf = await fixture(article("pdf", { type: "pdf", path: "content/pdf/article.pdf" }), "%PDF-1.4\nfixture");
  const pdfArticle = (await loadArticles(pdf.root, 2026)).articles[0];
  assert.equal(Buffer.from(pdfArticle.body, "base64").toString(), "%PDF-1.4\nfixture");
  assert.equal(pdfArticle.url, null);
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

test("metadata schema rejects missing, unknown and incompatible fields with their paths", () => {
  const { title, ...missingTitle } = article();
  const cases = [
    [missingTitle, ["title"]],
    [{ ...article(), author: 42 }, ["author"]],
    [{ ...article(), extra: true }, []],
    [article("a", { type: "markdown", path: "content/a/article.pdf" }), ["content", "path"]],
    [article("a", { type: "pdf", path: "content/a/article.md" }), ["content", "path"]],
    [article("a", { type: "external", path: "content/a/article.md" }), ["content", "url"]],
    [article("a", { type: "markdown", path: "content/a/article.md", url: "https://example.com" }), ["content"]],
    [article("a", { type: "unknown" }), ["content", "type"]],
  ];
  for (const [value, issuePath] of cases) {
    // 拒否するだけでなく、ビルドログから修正すべき項目を特定できることも確認する。
    assert.throws(() => validateArticle(value, "a"), (error) => {
      assert.equal(error.name, "ZodError");
      assert.ok(error.issues.some((issue) => JSON.stringify(issue.path) === JSON.stringify(issuePath)));
      return true;
    });
  }
});

test("metadata validation preserves Unicode limits, Markdown whitespace and calendar dates", () => {
  // 絵文字のUTF-16の長さとコードポイント数は異なる。Botと同じ文字数制限になっているか確かめる。
  for (const [field, limit] of [["title", 256], ["author", 100], ["abstract", 4000]]) {
    const text = `  ${"😀".repeat(limit)}  `;
    assert.equal(validateArticle({ ...article(), [field]: text }, "a")[field], text);
    assert.throws(() => validateArticle({ ...article(), [field]: "😀".repeat(limit + 1) }, "a"));
    assert.throws(() => validateArticle({ ...article(), [field]: " \n\t" }, "a"));
  }
  const abstract = "    indented code\n\ntext with a hard break  \nnext line\n";
  assert.equal(validateArticle({ ...article(), abstract }, "a").abstract, abstract);
  assert.equal(validateArticle({ ...article(), date: "2024-02-29" }, "a").date, "2024-02-29");
  for (const date of ["2026-02-29", "2026-04-31", "2026-12-00", "2026-12-32", "2026-12-1"]) {
    assert.throws(() => validateArticle({ ...article(), date }, "a"), /real YYYY-MM-DD/);
  }
  for (const url of ["https://example.com/a b", "https://example.com/\n", `https://example.com/${"😀".repeat(1100)}`]) {
    assert.throws(() => validateArticle(article("a", { type: "external", url }), "a"), /HTTPS/);
  }
});

test("paths cannot escape their article directory, including through symlinks", async () => {
  // 文字列での脱出と、見かけは有効でも参照先が変わるシンボリックリンクを両方拒否する。
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
