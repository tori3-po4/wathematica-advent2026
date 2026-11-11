import { z } from "zod";
import { safeHttps } from "./markdown.mjs";

export const articleIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

function textField(limit) {
  // Count Unicode code points without trimming Markdown's meaningful whitespace.
  return z.string().refine((value) => {
    const length = [...value.trim()].length;
    return length > 0 && length <= limit;
  }, { error: `Must contain 1–${limit} characters` });
}

const articleSchema = z.strictObject({
  id: articleIdSchema,
  date: z.iso.date({ error: "date must be a real YYYY-MM-DD date" }),
  title: textField(256),
  author: textField(100),
  icon: z.string().endsWith(".png", { error: "icon must be a local PNG path" }),
  abstract: textField(4000),
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

export function validateArticle(value, directoryId) {
  return articleSchema.refine((article) => article.id === directoryId, {
    path: ["id"],
    error: "id must match its article directory",
  }).parse(value);
}
