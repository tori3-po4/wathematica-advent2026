/**
 * 公開日と検索の共通ロジック。DOMやReactに依存させず、任意の日時でテストできるようにする。
 * 記事はloadArticlesで対象年度・期間とYYYY-MM-DD形式を検証済みであることを前提とする。
 */

/** 端末のタイムゾーン設定によらず、日本時間（UTC+9）の日付を返す。 */
export function jstDate(now = new Date()) {
  // UTCの時刻を9時間進めてからISO形式を取り出し、日本の日付境界で区切る。
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 日付をゼロ埋めして、公開日と文字列比較できる形式にそろえる。
 * @param {number} year 対象年度
 * @param {number} day 12月の日（1〜25）
 */
export function dayDate(year, day) {
  return `${year}-12-${String(day).padStart(2, "0")}`;
}

/**
 * 今日の日付から公開済み記事とカレンダー全体の公開状況を算出する。
 * nowを省略すれば端末時計、指定すれば公開日前後などの境界を再現できる。
 * @template {{ date: string }} T
 * @param {number} year
 * @param {T[]} articles
 * @param {Date} [now]
 */
export function calendarState(year, articles, now = new Date()) {
  const today = jstDate(now);
  // YYYY-MM-DDは文字列順と日付順が一致する。上限を設けず、翌年以降も記事を公開し続ける。
  const published = articles.filter((article) => article.date <= today);
  // 記事の有無とは独立した「選べる日」の数。25日以降は25のままになる。
  const openedDays = Array.from({ length: 25 }, (_, i) => dayDate(year, i + 1))
    .filter((date) => date <= today).length;
  // 両辺を日付だけのUTC時刻として扱い、端末の時差を含めず暦日の差を求める。
  const daysUntilStart = Math.max(0, Math.round(
    (Date.parse(dayDate(year, 1)) - Date.parse(today)) / 86400000,
  ));
  return { today, published, openedDays, daysUntilStart };
}

/**
 * 日付と検索語をAND条件で適用する。公開判定は呼び出し側で済ませてから渡す。
 * @template {{ date: string, title: string, author: string }} T
 * @param {T[]} articles
 * @param {{ day?: number | null, query?: string }} [options]
 */
export function filterArticles(articles, { day = null, query = "" } = {}) {
  // 入力と記事の双方をNFKC・小文字へそろえ、全角英数字や大文字小文字の違いを吸収する。
  const term = query.trim().normalize("NFKC").toLocaleLowerCase("ja");
  return articles.filter((article) => (
    (!day || Number(article.date.slice(-2)) === day)
    && (!term || `${article.title} ${article.author}`.normalize("NFKC").toLocaleLowerCase("ja").includes(term))
  ));
}
