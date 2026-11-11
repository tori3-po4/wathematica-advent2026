import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Build realistic content in an isolated directory, leaving real articles and dist alone.
const front = fileURLToPath(new URL("../", import.meta.url));
const root = await mkdtemp(path.join(tmpdir(), "wathematica-react-"));
const astro = path.join(front, "node_modules/astro/bin/astro.mjs");
let child;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child?.kill(signal));

try {
  for (const name of ["src", "scripts", "astro.config.mjs", "tsconfig.json", "package.json", "THIRD_PARTY_NOTICES.md"]) {
    await cp(path.join(front, name), path.join(root, name), { recursive: true });
  }
  await symlink(path.join(front, "node_modules"), path.join(root, "node_modules"), "dir");
  await writeFile(path.join(root, "site.config.json"), JSON.stringify({ year: 2026 }));
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nSAAAAAASUVORK5CYII=", "base64");
  for (const [id, date, title, author, type] of [
    ["math", "2026-12-01", "数学の話", "Alice", "markdown"],
    ["pdf", "2026-12-01", "PDFの記事", "Bob", "pdf"],
    ["external", "2026-12-02", "外部記事", "Carol", "external"],
    ["last", "2026-12-25", "最終日の記事", "Dave", "markdown"],
  ]) {
    const dir = path.join(root, "content", id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "icon.png"), png);
    const content = type === "external" ? { type, url: "https://example.com/article" }
      : { type, path: `content/${id}/article.${type === "pdf" ? "pdf" : "md"}` };
    await writeFile(path.join(dir, "article.json"), JSON.stringify({
      id, date, title, author, icon: `content/${id}/icon.png`, abstract: "**概要**です。", content,
    }));
    if (type !== "external") {
      await writeFile(path.join(root, content.path), type === "pdf" ? "%PDF-1.4\nfixture"
        : "# 見出し\n本文\n\n<script>window.articleScriptRan = true</script>");
    }
  }
  const run = (args) => new Promise((resolve, reject) => {
    child = spawn(process.execPath, [astro, ...args], { cwd: root, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 || signal ? resolve() : reject(new Error(`Astro exited ${code}`)));
  });
  await run(["build"]);
  await run(["preview", "--ignore-lock", "--host", "127.0.0.1", "--port", "4322"]);
} finally {
  await rm(root, { recursive: true, force: true });
}
