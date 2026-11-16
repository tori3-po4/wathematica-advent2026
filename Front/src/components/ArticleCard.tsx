import type { Article } from "../types";

const labels = { pdf: "PDF", external: "外部記事" };

/** 検証・変換済みの1記事を描画する。本文の扱いはPDF・外部URLで切り替える。 */
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
      {/* Reactのテキスト描画でHTMLをエスケープし、入力された改行を保つ。 */}
      <p className="whitespace-pre-wrap">{article.abstract}</p>
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
