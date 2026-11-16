import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { articleIdSchema, safeHttps, validateArticle } from "./article-schema.mjs";

// テストなど既存の呼び出し元も、この読み込みモジュール経由でメタデータを検証できるようにする。
export { validateArticle } from "./article-schema.mjs";

// 不正なUTF-8を置換文字で黙って読み込まず、JSONの破損としてビルドを止める。
const decoder = new TextDecoder("utf-8", { fatal: true });
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

/** 記事ディレクトリ内の通常ファイルだけを、指定したサイズ上限内で読み込む。 */
async function readAsset(frontRoot, id, relativePath, limit) {
  const prefix = `content/${id}/`;
  // 他の記事・親ディレクトリへの参照や、OSによって解釈が変わる区切り文字を拒否する。
  requireValue(typeof relativePath === "string" && relativePath.startsWith(prefix) && !relativePath.includes("\\") && !relativePath.includes("\0") && relativePath.split("/").every((part) => part && part !== "." && part !== ".."), `Invalid article path: ${relativePath}`);
  const absolute = path.resolve(frontRoot, relativePath);
  // 文字列のパスが正しくても、途中のシンボリックリンクで読み込み先が変わる場合は拒否する。
  requireValue(await realpath(absolute) === absolute, `Symlinks are not allowed: ${relativePath}`);
  const stat = await lstat(absolute);
  requireValue(stat.isFile() && stat.size > 0 && stat.size <= limit, `Invalid file or size: ${relativePath}`);
  return readFile(absolute);
}

/**
 * ビルド時専用の入口。Bot形式のファイルを読み、Reactへ渡す自己完結した記事データに変換する。
 * 対象期間外の記事は警告付きで除外し、不正・欠損データは公開物へ混ぜずビルドを失敗させる。
 */
export async function loadArticles(frontRoot, year) {
  requireValue(Number.isInteger(year) && year >= 1000 && year <= 9999, "year must be a four-digit year");
  // 読み込み元自体を実パスにそろえ、readAssetでリンクの有無を比較できるようにする。
  const root = await realpath(frontRoot);
  const entries = await readdir(path.join(root, "content"), { withFileTypes: true });
  /** @type {import("../src/types.ts").Article[]} */
  const articles = [];
  const warnings = [];
  // ファイルシステムの列挙順に依存せず、検証と警告の順番を安定させる。
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    // 空の記事ディレクトリをGitで維持する.gitkeepなどは読み込み対象にしない。
    if (entry.name.startsWith(".")) continue;
    requireValue(!entry.isSymbolicLink(), `Symlinks are not allowed: content/${entry.name}`);
    if (!entry.isDirectory()) continue;
    requireValue(articleIdSchema.safeParse(entry.name).success, `Invalid article directory: ${entry.name}`);
    try {
      // JSON自体のサイズ・文字コードと、メタデータのスキーマを順に確認する。
      const metadata = await readAsset(root, entry.name, `content/${entry.name}/article.json`, 64 * 1024);
      const value = validateArticle(JSON.parse(decoder.decode(metadata)), entry.name);
      // Botは実在する日付全般を受け付けるため、掲載する年度・期間の制限はこちらで行う。
      if (!value.date.startsWith(`${year}-12-`) || Number(value.date.slice(-2)) > 25) {
        warnings.push(`${entry.name}: ${value.date} is outside December 1–25, ${year}; omitted.`);
        continue;
      }
      const icon = await readAsset(root, value.id, value.icon, 2 * 1024 * 1024);
      // 拡張子だけではPNGと判断しない。シグネチャ・IHDR・画素数をBotと同じ基準で確認する。
      requireValue(icon.length >= 24 && icon.subarray(0, 8).equals(pngSignature) && icon.toString("ascii", 12, 16) === "IHDR", "Invalid PNG icon");
      const width = icon.readUInt32BE(16);
      const height = icon.readUInt32BE(20);
      requireValue(width > 0 && height > 0 && width * height <= 16000000, "Icon exceeds 16 million pixels");
      let body = null;
      if (value.content.type === "pdf") {
        const file = await readAsset(root, value.id, value.content.path, 20 * 1024 * 1024);
        requireValue(file.subarray(0, 5).toString() === "%PDF-", "Invalid PDF signature");
        body = file.toString("base64");
      }
      // 元のパスではなくテキスト・data URL・Base64を渡し、閲覧中の記事取得APIを不要にする。
      // 未公開記事も同梱されるため、ブラウザ側の日付制御は秘密保持には使えない。
      articles.push({
        id: value.id, date: value.date, title: value.title.trim(), author: value.author.trim(),
        icon: `data:image/png;base64,${icon.toString("base64")}`,
        abstract: value.abstract, type: value.content.type,
        url: value.content.type === "external" ? safeHttps(value.content.url) : null, body,
      });
    } catch (error) {
      // ホスティングのビルドログから、修正すべき記事フォルダを特定できるようにする。
      throw new Error(`content/${entry.name}: ${error.message}`, { cause: error });
    }
  }
  // 同日投稿はID順に固定し、一覧とカレンダーの代表アイコンの順序を安定させる。
  articles.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { articles, warnings };
}
