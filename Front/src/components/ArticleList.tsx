import type { Article } from "../types";
import ArticleCard from "./ArticleCard";

interface Props {
  /** 公開前を含む全記事。検索で除外された記事も含め、DOMを維持する。 */
  articles: Article[];
  /** 日付・キーワードの両方に一致し、実際に表示する記事のID。 */
  visibleIds: Set<string>;
  selectedDay: number | null;
  query: string;
  today: string | null;
  onQueryChange: (query: string) => void;
}

/** 検索フォーム、件数、記事カード、結果が空の場合の案内をまとめる表示コンポーネント。 */
export default function ArticleList({ articles, visibleIds, selectedDay, query, today, onQueryChange }: Props) {
  // 同じ0件でも次の操作が異なるため、検索不一致 → 指定日の準備中 → 未登録の順で案内する。
  const [emptyTitle, emptyDescription] = query.trim()
    ? ["一致する記事が見つかりませんでした。", "キーワードを変えるか、日付の絞り込みを解除してお試しください。"]
    : selectedDay
      ? [`12月${selectedDay}日の記事を準備しています。`, "ほかの日付を選ぶと、登録済みの記事の概要を確認できます。"]
      : ["記事はまだ登録されていません。", "記事が登録されると、ここに表示されます。"];

  return (
    <section className="my-8" id="articles" aria-labelledby="articles-heading">
      <h2 className="text-[1.25rem]" id="articles-heading">記事一覧</h2>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="article-search">タイトル・著者名で検索</label>
        <input className="min-w-0 max-w-full [font:inherit]" id="article-search" type="search" autoComplete="off" value={query}
          onChange={(event) => onQueryChange(event.target.value)} />
      </div>
      {/* 検索のたびにフォーカスを動かさず、変更した件数を読み上げで通知する。 */}
      <p className="text-[#555]" id="result-count" role="status" aria-live="polite">{visibleIds.size}件の記事</p>
      <p className="text-[#555]" id="filter-status" hidden={selectedDay === null}>{selectedDay ? `12月${selectedDay}日の記事を表示中` : ""}</p>
      <div id="article-list">
        {/* 検索でカードを作り直さず hidden で切り替え、本文の開閉状態やDOMの同一性を保つ。 */}
        {articles.map((article) => <ArticleCard key={article.id} article={article} hidden={!visibleIds.has(article.id)} today={today} />)}
      </div>
      <div className="text-[#555]" id="empty-state" hidden={visibleIds.size > 0}>
        <p id="empty-title">{emptyTitle}</p>
        <p id="empty-description">{emptyDescription}</p>
      </div>
    </section>
  );
}
