import { z } from "zod";

/** HTTPS・資格情報なしのURLを正規化して返す。許可できない入力はnullにする。 */
export function safeHttps(value) {
  // URLコンストラクターが補正・除去する空白や制御文字も、入力段階で明示的に拒否する。
  if (typeof value !== "string" || /[\s\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

// Botの出力形式をフロントのビルド時にも検証する。手編集された記事も無条件には信頼しない。
// メタデータの形はここで、参照先ファイルの実体・サイズ・格納範囲はcontent.mjsで確認する。
export const articleIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

/** 空白だけの値を拒否し、Unicodeコードポイント単位で文字数制限を確認する。 */
function textField(limit) {
  // trimは検証用だけに使い、表示する文字列の改行や空白は保つ。
  return z.string().refine((value) => {
    const length = [...value.trim()].length;
    return length > 0 && length <= limit;
  }, { error: `Must contain 1–${limit} characters` });
}

// 未知のキーも拒否し、フィールド名の誤りや記事形式に合わない項目を早く発見する。
const articleSchema = z.strictObject({
  id: articleIdSchema,
  date: z.iso.date({ error: "date must be a real YYYY-MM-DD date" }),
  title: textField(256),
  author: textField(100),
  icon: z.string().endsWith(".png", { error: "icon must be a local PNG path" }),
  abstract: textField(4000),
  // 外部記事はURL、PDF記事はファイルパスを必須にする。
  content: z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("external"),
      url: z.string().refine((value) => value.length <= 2048 && Boolean(safeHttps(value)), {
        error: "External URL must use HTTPS without credentials",
      }),
    }),
    z.strictObject({
      type: z.literal("pdf"),
      path: z.string().endsWith(".pdf"),
    }),
  ]),
});

/** 保存先ディレクトリと記事IDの一致まで検証し、失敗時は項目の位置付きで例外を投げる。 */
export function validateArticle(value, directoryId) {
  return articleSchema.refine((article) => article.id === directoryId, {
    path: ["id"],
    error: "id must match its article directory",
  }).parse(value);
}
