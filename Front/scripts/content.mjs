import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { renderMarkdown, safeHttps } from "./markdown.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
const idPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function shape(value, keys, label) {
  requireValue(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  requireValue(Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => Object.hasOwn(value, key)), `${label} must contain exactly: ${keys.join(", ")}`);
}

export function validateArticle(value, directoryId) {
  shape(value, ["id", "date", "title", "author", "icon", "abstract", "content"], "article");
  requireValue(typeof value.id === "string" && idPattern.test(value.id) && value.id === directoryId, "id must match its article directory");
  requireValue(typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && Number.isFinite(Date.parse(value.date)) && new Date(value.date).toISOString().slice(0, 10) === value.date, "date must be a real YYYY-MM-DD date");
  for (const [key, limit] of [["title", 256], ["author", 100], ["abstract", 4000]]) {
    requireValue(typeof value[key] === "string" && value[key].trim().length > 0 && [...value[key].trim()].length <= limit, `${key} must contain 1–${limit} characters`);
  }
  requireValue(typeof value.icon === "string" && value.icon.endsWith(".png"), "icon must be a local PNG path");
  const content = value.content;
  requireValue(content && ["external", "markdown", "pdf"].includes(content.type), "Unsupported content.type");
  if (content.type === "external") {
    shape(content, ["type", "url"], "content");
    requireValue(typeof content.url === "string" && content.url.length <= 2048 && safeHttps(content.url), "External URL must use HTTPS without credentials");
  } else {
    shape(content, ["type", "path"], "content");
    requireValue(typeof content.path === "string" && (content.type === "pdf" ? /\.pdf$/ : /\.(md|markdown)$/).test(content.path), "Body path extension must match content.type");
  }
  return value;
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
  const root = await realpath(frontRoot);
  const entries = await readdir(path.join(root, "content"), { withFileTypes: true });
  const articles = [];
  const warnings = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    requireValue(!entry.isSymbolicLink(), `Symlinks are not allowed: content/${entry.name}`);
    if (!entry.isDirectory()) continue;
    requireValue(idPattern.test(entry.name), `Invalid article directory: ${entry.name}`);
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
