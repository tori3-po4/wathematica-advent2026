import type { Article } from "../types";
import ArticleCard from "./ArticleCard";

interface Props {
  year: number;
  articles: Article[];
  visibleIds: Set<string>;
  selectedDay: number | null;
  query: string;
  beforeStart: boolean;
  onQueryChange: (query: string) => void;
  onReset: () => void;
}

export default function ArticleList({ year, articles, visibleIds, selectedDay, query, beforeStart, onQueryChange, onReset }: Props) {
  const [emptyTitle, emptyDescription] = query.trim()
    ? ["一致する記事が見つかりませんでした。", "キーワードを変えるか、日付の絞り込みを解除してお試しください。"]
    : selectedDay
      ? [`12月${selectedDay}日の記事を準備しています。`, "ほかの日付を選ぶと、公開済みの記事を読めます。"]
      : ["公開済みの記事はありません。", beforeStart ? `${year}年12月1日から記事を表示します。` : "記事が登録されると、ここに表示されます。"];

  return (
    <section id="articles" aria-labelledby="articles-heading">
      <h2 id="articles-heading">記事一覧</h2>
      <div className="article-toolbar">
        <button type="button" id="reset-filter" onClick={onReset}>絞り込みを解除</button>
        <label htmlFor="article-search">タイトル・著者名で検索</label>
        <input id="article-search" type="search" autoComplete="off" value={query}
          onChange={(event) => onQueryChange(event.target.value)} />
      </div>
      <p id="result-count" role="status" aria-live="polite">{visibleIds.size}件の記事</p>
      <p id="filter-status" hidden={selectedDay === null}>{selectedDay ? `12月${selectedDay}日の記事を表示中` : ""}</p>
      <div id="article-list">
        {/* Stable keys and hidden preserve expanded bodies and focus while filtering. */}
        {articles.map((article) => <ArticleCard key={article.id} article={article} hidden={!visibleIds.has(article.id)} />)}
      </div>
      <div id="empty-state" hidden={visibleIds.size > 0}>
        <p id="empty-title">{emptyTitle}</p>
        <p id="empty-description">{emptyDescription}</p>
      </div>
    </section>
  );
}
