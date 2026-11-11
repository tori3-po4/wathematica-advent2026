import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { renderMarkdown, safeHttps } from "./markdown.mjs";
import { articleIdSchema, validateArticle } from "./article-schema.mjs";

export { validateArticle } from "./article-schema.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function readAsset(frontRoot, id, relativePath, limit) {
  const prefix = `content/${id}/`;
  requireValue(typeof relativePath === "string" && relativePath.startsWith(prefix) && !relativePath.includes("\\") && !relativePath.includes("\0") && relativePath.split("/").every((part) => part && part !== "." && part !== ".."), `Invalid article path: ${relativePath}`);
  const absolute = path.resolve(frontRoot, relativePath);
  requireValue(await realpath(absolute) === absolute, `Symlinks are not allowed: ${relativePath}`);
  const stat = await lstat(absolute);
  requireValue(stat.isFile() && stat.size > 0 && stat.size <= limit, `Invalid file or size: ${relativePath}`);
  return readFile(absolute);
}

export async function loadArticles(frontRoot, year) {
  requireValue(Number.isInteger(year) && year >= 1000 && year <= 9999, "year must be a four-digit year");
  const root = await realpath(frontRoot);
  const entries = await readdir(path.join(root, "content"), { withFileTypes: true });
  /** @type {import("../src/types.ts").Article[]} */
  const articles = [];
  const warnings = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    requireValue(!entry.isSymbolicLink(), `Symlinks are not allowed: content/${entry.name}`);
    if (!entry.isDirectory()) continue;
    requireValue(articleIdSchema.safeParse(entry.name).success, `Invalid article directory: ${entry.name}`);
    try {
      const metadata = await readAsset(root, entry.name, `content/${entry.name}/article.json`, 64 * 1024);
      const value = validateArticle(JSON.parse(decoder.decode(metadata)), entry.name);
      if (!value.date.startsWith(`${year}-12-`) || Number(value.date.slice(-2)) > 25) {
        warnings.push(`${entry.name}: ${value.date} is outside December 1–25, ${year}; omitted.`);
        continue;
      }
      const icon = await readAsset(root, value.id, value.icon, 2 * 1024 * 1024);
      requireValue(icon.length >= 24 && icon.subarray(0, 8).equals(pngSignature) && icon.toString("ascii", 12, 16) === "IHDR", "Invalid PNG icon");
      const width = icon.readUInt32BE(16);
      const height = icon.readUInt32BE(20);
      requireValue(width > 0 && height > 0 && width * height <= 16000000, "Icon exceeds 16 million pixels");
      let body = null;
      if (value.content.type !== "external") {
        const file = await readAsset(root, value.id, value.content.path, 20 * 1024 * 1024);
        if (value.content.type === "markdown") {
          const markdown = decoder.decode(file);
          requireValue(!markdown.includes("\0"), "Markdown must not contain NUL characters");
          body = await renderMarkdown(markdown, `${value.id}-body`);
        } else {
          requireValue(file.subarray(0, 5).toString() === "%PDF-", "Invalid PDF signature");
          body = file.toString("base64");
        }
      }
      articles.push({
        id: value.id, date: value.date, title: value.title.trim(), author: value.author.trim(),
        icon: `data:image/png;base64,${icon.toString("base64")}`,
        abstract: await renderMarkdown(value.abstract, `${value.id}-abstract`), type: value.content.type,
        url: value.content.type === "external" ? safeHttps(value.content.url) : null, body,
      });
    } catch (error) {
      throw new Error(`content/${entry.name}: ${error.message}`, { cause: error });
    }
  }
  articles.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { articles, warnings };
}
