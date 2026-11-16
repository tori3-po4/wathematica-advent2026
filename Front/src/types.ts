/**
 * loadArticles がBotのメタデータ・添付ファイルを検証し、React用に変換した記事。
 * 元のarticle.jsonとは異なり、表示に必要なデータを同梱し、実行時のファイル取得を不要にする。
 */
export interface Article {
  id: string;
  /** 検証済みのYYYY-MM-DD形式。日付順の文字列比較による公開判定に使用する。 */
  date: string;
  title: string;
  author: string;
  /** PNGを埋め込んだdata URL。元のファイルパスはブラウザへ渡さない。 */
  icon: string;
  /** scripts/markdown.mjs がビルド時にサニタイズした概要のHTML。 */
  abstract: string;
  type: "markdown" | "pdf" | "external";
  /** Markdownならサニタイズ済みHTML、PDFならBase64文字列、外部記事ならnull。 */
  body: string | null;
  /** 外部記事のみ検証済みのHTTPS URLを持ち、それ以外はnull。 */
  url: string | null;
}
