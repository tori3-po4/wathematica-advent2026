import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ZodError } from "zod";
import { loadArticles, validateArticle } from "../scripts/content.ts";

// 外部データに依存しない最小のPNGとBot形式のメタデータを、各テストの起点にする。
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nSAAAAAASUVORK5CYII=", "base64");
const article = (
  id = "a",
  content: { type: string; path?: string; url?: string } = { type: "pdf", path: `content/${id}/article.pdf` },
) => ({
  id, date: "2026-12-01", title: "テスト記事", author: "著者", icon: `content/${id}/icon.png`, abstract: "**概要**です。", content,
});

/** 毎回別の一時フォルダに投稿一式を作り、破損・パス改変のテストが実記事へ影響しないようにする。 */
async function fixture(value: ReturnType<typeof article>, body = "%PDF-1.4\nfixture") {
  const root = await mkdtemp(path.join(tmpdir(), "wathematica-content-"));
  const dir = path.join(root, "content", value.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "article.json"), JSON.stringify(value));
  await writeFile(path.join(dir, "icon.png"), png);
  if (value.content.type === "pdf") await writeFile(path.join(dir, "article.pdf"), body);
  return { root, dir };
}

test("loads the Bot schema for PDF and external articles with plain-text abstracts", async () => {
  const abstract = "**概要**です。\n<script>alert(1)</script>\n![画像](https://example.com/image.png)";
  const pdf = await fixture({ ...article(), abstract });
  const pdfArticle = (await loadArticles(pdf.root, 2026)).articles[0];
  assert.equal(pdfArticle.abstract, abstract);
  assert.equal(pdfArticle.type, "pdf");
  assert.equal(pdfArticle.icon, `data:image/png;base64,${png.toString("base64")}`);
  assert.ok(pdfArticle.body);
  assert.equal(Buffer.from(pdfArticle.body, "base64").toString(), "%PDF-1.4\nfixture");
  assert.equal(pdfArticle.url, null);
  const external = await fixture(article("url", { type: "external", url: "https://example.com/article" }));
  const externalArticle = (await loadArticles(external.root, 2026)).articles[0];
  assert.equal(externalArticle.type, "external");
  assert.equal(externalArticle.url, "https://example.com/article");
  assert.equal(externalArticle.body, null);
});

test("invalid metadata, URLs, icon dimensions and missing files fail the build", async () => {
  assert.throws(() => validateArticle({ ...article(), date: "2026-02-30" }, "a"), /real YYYY-MM-DD/);
  assert.throws(() => validateArticle(article(), "other"), /match its article directory/);
  for (const url of ["javascript:alert(1)", "http://example.com", "https://user:password@example.com"]) {
    assert.throws(() => validateArticle(article("a", { type: "external", url }), "a"), /HTTPS/);
  }
  const invalidIcon = await fixture(article());
  const zeroWidthIcon = Buffer.from(png);
  zeroWidthIcon.writeUInt32BE(0, 16);
  await writeFile(path.join(invalidIcon.dir, "icon.png"), zeroWidthIcon);
  await assert.rejects(loadArticles(invalidIcon.root, 2026), /Icon exceeds 16 million pixels/);
  const missing = await fixture(article("a", { type: "pdf", path: "content/a/missing.pdf" }));
  await assert.rejects(loadArticles(missing.root, 2026), /ENOENT/);
  const invalidUtf8 = await fixture(article());
  await writeFile(path.join(invalidUtf8.dir, "article.json"), Buffer.from([255]));
  await assert.rejects(loadArticles(invalidUtf8.root, 2026), /encoded data/);
});

test("metadata schema rejects missing, unknown and incompatible fields with their paths", () => {
  const { title, ...missingTitle } = article();
  const cases: [unknown, string[]][] = [
    [missingTitle, ["title"]],
    [{ ...article(), author: 42 }, ["author"]],
    [{ ...article(), extra: true }, []],
    [article("a", { type: "markdown", path: "content/a/article.md" }), ["content", "type"]],
    [article("a", { type: "pdf", path: "content/a/article.md" }), ["content", "path"]],
    [article("a", { type: "external", path: "content/a/article.pdf" }), ["content", "url"]],
    [article("a", { type: "pdf", path: "content/a/article.pdf", url: "https://example.com" }), ["content"]],
    [article("a", { type: "unknown" }), ["content", "type"]],
  ];
  for (const [value, issuePath] of cases) {
    // 拒否するだけでなく、ビルドログから修正すべき項目を特定できることも確認する。
    assert.throws(() => validateArticle(value, "a"), (error: unknown) => {
      assert.ok(error instanceof ZodError);
      assert.ok(error.issues.some((issue) => JSON.stringify(issue.path) === JSON.stringify(issuePath)));
      return true;
    });
  }
});

test("metadata validation preserves Unicode limits, plain-text whitespace and calendar dates", () => {
  // 絵文字のUTF-16の長さとコードポイント数は異なる。Botと同じ文字数制限になっているか確かめる。
  for (const [field, limit] of [["title", 256], ["author", 100], ["abstract", 4000]] as const) {
    const text = `  ${"😀".repeat(limit)}  `;
    assert.equal(validateArticle({ ...article(), [field]: text }, "a")[field], text);
    assert.throws(() => validateArticle({ ...article(), [field]: "😀".repeat(limit + 1) }, "a"));
    assert.throws(() => validateArticle({ ...article(), [field]: " \n\t" }, "a"));
  }
  const abstract = "    概要の1行目\n\n2行目  \n3行目\n";
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
  for (const bodyPath of ["content/a/../other.pdf", "/etc/passwd.pdf", "content/b/article.pdf", "content/a/../../secret.pdf"]) {
    const value = article("a", { type: "pdf", path: bodyPath });
    const { root } = await fixture(value);
    await assert.rejects(loadArticles(root, 2026), /Invalid article path/);
  }
  const value = article("a", { type: "pdf", path: "content/a/link.pdf" });
  const { root, dir } = await fixture(value);
  await symlink(path.join(dir, "article.pdf"), path.join(dir, "link.pdf"));
  await assert.rejects(loadArticles(root, 2026), /Symlinks are not allowed/);
});

test("valid dates outside the selected advent season are omitted with a warning", async () => {
  const { root } = await fixture({ ...article(), date: "2025-12-01" });
  const result = await loadArticles(root, 2026);
  assert.equal(result.articles.length, 0);
  assert.equal(result.warnings.length, 1);
});

test("Markdown articles are rejected before loading body files", async () => {
  for (const extension of ["md", "markdown"]) {
    const { root } = await fixture(article("a", { type: "markdown", path: `content/a/article.${extension}` }));
    await assert.rejects(loadArticles(root, 2026), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^content\/a:/);
      assert.ok(error.cause instanceof ZodError);
      assert.deepEqual(error.cause.issues[0].path, ["content", "type"]);
      return true;
    });
  }
});
