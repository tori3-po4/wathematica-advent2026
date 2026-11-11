export interface Article {
  id: string;
  date: string;
  title: string;
  author: string;
  icon: string;
  /** HTML sanitized by scripts/markdown.mjs at build time. */
  abstract: string;
  type: "markdown" | "pdf" | "external";
  /** Sanitized HTML for Markdown articles, Base64 for PDFs. */
  body: string | null;
  /** An HTTPS external article URL. */
  url: string | null;
}
