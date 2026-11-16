import type { Article } from "../types";

const labels = { markdown: "Markdown", pdf: "PDF", external: "外部記事" };

// Markdown is generated at build time, so style its elements from the wrapper.
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

export default function ArticleCard({ article, hidden }: { article: Article; hidden: boolean }) {
  return (
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
      {/* Only HTML sanitized by scripts/markdown.mjs is passed to this component. */}
      <div className={proseClasses} dangerouslySetInnerHTML={{ __html: article.abstract }} />
      {article.type === "markdown" && (
        <details className="mt-4">
          <summary className="cursor-pointer">本文を表示</summary>
          <div className={`${proseClasses} mt-4`} dangerouslySetInnerHTML={{ __html: article.body ?? "" }} />
        </details>
      )}
      {article.type === "pdf" && (
        <a className="read-link mt-4 inline-block" href={`data:application/pdf;base64,${article.body}`} download={`${article.id}.pdf`}>PDFをダウンロード</a>
      )}
      {article.type === "external" && (
        <a className="read-link mt-4 inline-block" href={article.url ?? undefined} target="_blank" rel="noopener noreferrer">
          外部サイトで読む（別タブ）
        </a>
      )}
    </article>
  );
}
