import type { Article } from "./types.ts";

/**
 * 公開日と検索の共通ロジック。DOMやReactに依存させず、任意の日時でテストできるようにする。
 * 記事はloadArticlesで対象年度・期間とYYYY-MM-DD形式を検証済みであることを前提とする。
 */

/** 端末のタイムゾーン設定によらず、日本時間（UTC+9）の日付を返す。 */
export function jstDate(now: Date = new Date()) {
  // UTCの時刻を9時間進めてからISO形式を取り出し、日本の日付境界で区切る。
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 日付をゼロ埋めして、公開日と文字列比較できる形式にそろえる。
 * yearは対象年度、dayは12月の日（1〜25）。
 */
export function dayDate(year: number, day: number) {
  return `${year}-12-${String(day).padStart(2, "0")}`;
}

/**
 * 本文だけを公開日で制御する。日付未確定時はロックし、概要の表示や検索には使わない。
 * YYYY-MM-DDは文字列順と日付順が一致し、翌年以降も公開済みの本文を読み続けられる。
 */
export function isContentPublished(date: string, today: string | null) {
  return today !== null && date <= today;
}

/**
 * 日付と検索語をAND条件で適用する。公開前の記事も概要を検索できる。
 */
export function filterArticles<T extends Pick<Article, "date" | "title" | "author">>(
  articles: T[],
  { day = null, query = "" }: { day?: number | null; query?: string } = {},
) {
  // 入力と記事の双方をNFKC・小文字へそろえ、全角英数字や大文字小文字の違いを吸収する。
  const term = query.trim().normalize("NFKC").toLocaleLowerCase("ja");
  return articles.filter((article) => (
    (!day || Number(article.date.slice(-2)) === day)
    && (!term || `${article.title} ${article.author}`.normalize("NFKC").toLocaleLowerCase("ja").includes(term))
  ));
}
