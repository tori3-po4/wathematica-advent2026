export function jstDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** @param {number} year @param {number} day */
export function dayDate(year, day) {
  return `${year}-12-${String(day).padStart(2, "0")}`;
}

/**
 * @template {{ date: string }} T
 * @param {number} year
 * @param {T[]} articles
 * @param {Date} [now]
 */
export function calendarState(year, articles, now = new Date()) {
  const today = jstDate(now);
  const published = articles.filter((article) => article.date <= today);
  const openedDays = Array.from({ length: 25 }, (_, i) => dayDate(year, i + 1))
    .filter((date) => date <= today).length;
  const daysUntilStart = Math.max(0, Math.round(
    (Date.parse(dayDate(year, 1)) - Date.parse(today)) / 86400000,
  ));
  return { today, published, openedDays, daysUntilStart };
}

/**
 * @template {{ date: string, title: string, author: string }} T
 * @param {T[]} articles
 * @param {{ day?: number | null, query?: string }} [options]
 */
export function filterArticles(articles, { day = null, query = "" } = {}) {
  const term = query.trim().normalize("NFKC").toLocaleLowerCase("ja");
  return articles.filter((article) => (
    (!day || Number(article.date.slice(-2)) === day)
    && (!term || `${article.title} ${article.author}`.normalize("NFKC").toLocaleLowerCase("ja").includes(term))
  ));
}
