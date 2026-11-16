import type { Article } from "../types";

const labels = { markdown: "Markdown", pdf: "PDF", external: "外部記事" };

// MarkdownのHTMLはビルド時に生成され、各要素へReact側でclassNameを付けられない。
// 親から子要素を指定し、コードや表が狭い画面でも横にあふれないようにする。
const proseClasses = [
  "prose wrap-anywhere",
  "[&_section]:my-8 [&_input]:[font:inherit]",
  "[&_h4]:text-[1.125rem] [&_h5]:text-[1rem] [&_h6]:text-[1rem]",
  "[&_pre]:overflow-x-auto [&_pre]:bg-[#f5f5f5] [&_pre]:p-3",
  "[&_code]:[font-family:ui-monospace,monospace]",
  "[&_blockquote]:mx-0 [&_blockquote]:border-l-[3px] [&_blockquote]:border-l-[#ccc] [&_blockquote]:pl-4",
  "[&_table]:block [&_table]:border-collapse [&_table]:overflow-x-auto",
  "[&_th]:border [&_th]:border-[#ccc] [&_th]:px-3 [&_th]:py-1.5",
  "[&_td]:border [&_td]:border-[#ccc] [&_td]:px-3 [&_td]:py-1.5",
].join(" ");

/** 検証・変換済みの1記事を描画する。本文の扱いはMarkdown・PDF・外部URLで切り替える。 */
export default function ArticleCard({ article, hidden }: { article: Article; hidden: boolean }) {
  return (
    // tabIndex=-1 により、通常のTab移動には加えず、記事への直リンク時だけフォーカスできる。
    <article className="wrap-anywhere border-t border-t-[#ddd] py-4" id={`article-${article.id}`} tabIndex={-1} hidden={hidden}>
      <div className="flex flex-wrap items-center gap-2 text-[0.875rem] text-[#555]">
        <time dateTime={article.date}>{article.date}</time>
        <span>{labels[article.type]}</span>
      </div>
      <h3 className="text-[1.125rem]"><a href={`#article-${article.id}`}>{article.title}</a></h3>
      <p className="author flex flex-wrap items-center gap-2">
        <img className="rounded-[50%] object-cover" src={article.icon} alt="" width="28" height="28" />
        <span>{article.author}</span>
      </p>
      {/* 概要・本文には scripts/markdown.mjs でサニタイズ済みのHTMLだけを渡す前提。生の投稿文は渡さない。 */}
      <div className={proseClasses} dangerouslySetInnerHTML={{ __html: article.abstract }} />
      {/* 本文はすでにHTMLに含まれているため、開閉時に記事を取得する通信は不要。 */}
      {article.type === "markdown" && (
        <details className="mt-4">
          <summary className="cursor-pointer">本文を表示</summary>
          <div className={`${proseClasses} mt-4`} dangerouslySetInnerHTML={{ __html: article.body ?? "" }} />
        </details>
      )}
      {/* PDFも埋め込みデータから保存し、ダウンロード用のサーバーを必要としない。 */}
      {article.type === "pdf" && (
        <a className="read-link mt-4 inline-block" href={`data:application/pdf;base64,${article.body}`} download={`${article.id}.pdf`}>PDFをダウンロード</a>
      )}
      {/* 外部サイトへは読者のクリックで移動し、元ページを保ったまま別タブで開く。 */}
      {article.type === "external" && (
        <a className="read-link mt-4 inline-block" href={article.url ?? undefined} target="_blank" rel="noopener noreferrer">
          外部サイトで読む（別タブ）
        </a>
      )}
    </article>
  );
}
