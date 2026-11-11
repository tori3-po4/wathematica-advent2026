import type { Article } from "../types";

const labels = { markdown: "Markdown", pdf: "PDF", external: "外部記事" };

export default function ArticleCard({ article, hidden }: { article: Article; hidden: boolean }) {
  return (
    <article className="article-card" id={`article-${article.id}`} tabIndex={-1} hidden={hidden}>
      <div className="article-meta">
        <time dateTime={article.date}>{article.date}</time>
        <span>{labels[article.type]}</span>
      </div>
      <h3><a href={`#article-${article.id}`}>{article.title}</a></h3>
      <p className="author">
        <img src={article.icon} alt="" width="28" height="28" />
        <span>{article.author}</span>
      </p>
      {/* Only HTML sanitized by scripts/markdown.mjs is passed to this component. */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: article.abstract }} />
      {article.type === "markdown" && (
        <details className="article-body">
          <summary>本文を表示</summary>
          <div className="prose body-content" dangerouslySetInnerHTML={{ __html: article.body ?? "" }} />
        </details>
      )}
      {article.type === "pdf" && (
        <a className="read-link" href={`data:application/pdf;base64,${article.body}`} download={`${article.id}.pdf`}>PDFをダウンロード</a>
      )}
      {article.type === "external" && (
        <a className="read-link" href={article.url ?? undefined} target="_blank" rel="noopener noreferrer">
          外部サイトで読む（別タブ）
        </a>
      )}
    </article>
  );
}
