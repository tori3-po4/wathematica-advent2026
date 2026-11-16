import { z } from "zod";
import { safeHttps } from "./markdown.mjs";

// Botの出力形式をフロントのビルド時にも検証する。手編集された記事も無条件には信頼しない。
// メタデータの形はここで、参照先ファイルの実体・サイズ・格納範囲はcontent.mjsで確認する。
export const articleIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

/** 空白だけの値を拒否し、Unicodeコードポイント単位で文字数制限を確認する。 */
function textField(limit) {
  // trimは検証用だけに使い、返す文字列は加工しない。Markdownの字下げや行末空白を守る。
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
  // typeに応じてURLかファイルパスの片方を必須にし、3形式の組み合わせを明確にする。
  content: z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("external"),
      url: z.string().refine((value) => value.length <= 2048 && Boolean(safeHttps(value)), {
        error: "External URL must use HTTPS without credentials",
      }),
    }),
    z.strictObject({
      type: z.literal("markdown"),
      path: z.string().regex(/\.(md|markdown)$/),
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
