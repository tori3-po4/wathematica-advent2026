import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ArticleMetadata } from "../scripts/article-schema.ts";

// Playwright用の静的サイトを一時ディレクトリに構築し、実記事や普段のdist/を上書きしない。
const front = fileURLToPath(new URL("../", import.meta.url));
const root = await mkdtemp(path.join(tmpdir(), "wathematica-react-"));
const astro = path.join(front, "node_modules/astro/bin/astro.mjs");
let child: ChildProcess | undefined;
// Playwrightが終了するときは、実行中のビルド・プレビューにも停止を伝える。
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => child?.kill(signal));

try {
  // ページが参照するロゴなども含め、一時サイトのビルドに必要なファイルをそろえる。
  for (const name of ["src", "scripts", "asset", "astro.config.mjs", "tsconfig.json", "package.json", "THIRD_PARTY_NOTICES.md"]) {
    await cp(path.join(front, name), path.join(root, name), { recursive: true });
  }
  // インストール済み依存を共有し、テスト用の追加インストールを不要にする。
  await symlink(path.join(front, "node_modules"), path.join(root, "node_modules"), "dir");
  await writeFile(path.join(root, "site.config.json"), JSON.stringify({ year: 2026 }));
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nSAAAAAASUVORK5CYII=", "base64");
  // 同日複数投稿・PDFと外部記事・最終日をそろえ、ブラウザ時計だけで公開状況を切り替えられるようにする。
  for (const [id, date, title, author, type] of [
    ["math", "2026-12-01", "数学の話", "Alice", "pdf"],
    ["pdf", "2026-12-01", "PDFの記事", "Bob", "pdf"],
    ["external", "2026-12-02", "外部記事", "Carol", "external"],
    ["last", "2026-12-25", "最終日の記事", "Dave", "external"],
  ] as const) {
    const dir = path.join(root, "content", id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "icon.png"), png);
    const content: ArticleMetadata["content"] = type === "external" ? { type, url: "https://example.com/article" }
      : { type, path: `content/${id}/article.pdf` };
    await writeFile(path.join(dir, "article.json"), JSON.stringify({
      id, date, title, author, icon: `content/${id}/icon.png`,
      abstract: '**概要**です。\n<script>window.articleScriptRan = true</script>\n<img src="https://example.com/tracker.png" onerror="alert(1)">', content,
    }));
    if (content.type === "pdf") {
      await writeFile(path.join(root, content.path), "%PDF-1.4\nfixture");
    }
  }
  // 同じNode.jsでAstroを起動し、ビルドの完了を待ってから生成物を配信する。
  const run = (args: string[]) => new Promise<void>((resolve, reject) => {
    // テストはルート("/")での配信を前提にするため、公開用のサブパス指定は引き継がない。
    const env = { ...process.env };
    delete env.SITE_URL;
    delete env.BASE_PATH;
    child = spawn(process.execPath, [astro, ...args], { cwd: root, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 || signal ? resolve() : reject(new Error(`Astro exited ${code}`)));
  });
  await run(["build"]);
  await run(["preview", "--ignore-lock", "--host", "127.0.0.1", "--port", "4322"]);
} finally {
  // プレビューの終了後、テストで生成した一時サイトだけを片付ける。
  await rm(root, { recursive: true, force: true });
}
