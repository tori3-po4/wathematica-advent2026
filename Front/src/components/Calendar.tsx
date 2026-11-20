// Adapted from the 2025 Calendar. See THIRD_PARTY_NOTICES.md.
import DayTag from "./DayTag";
import type { Article } from "../types";

interface Props {
  year: number;
  /** loadArticles で対象年度の12月1〜25日に限定した記事。公開前の記事も含む。 */
  articles: Article[];
  today: string | null;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
}

/** 月の配置と日ごとの記事の振り分けを担当し、ボタンの表示は DayTag に任せる。 */
export default function Calendar({ year, articles, today, selectedDay, onSelectDay }: Props) {
  // 実行環境のタイムゾーンに左右されず、対象年度の12月1日の曜日を求める。
  const firstWeekday = new Date(Date.UTC(year, 11, 1)).getUTCDay();
  return (
    <section className="my-8" id="calendar" aria-labelledby="calendar-heading">
      <ul className="border-b m-0 mb-2 grid list-none grid-cols-7 gap-1 p-0 text-center" aria-hidden="true">
        {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
          <li key={day} className={day === "日" ? "text-red-600" : undefined}>{day}</li>
        ))}
      </ul>
      <div className="grid grid-cols-7 gap-1" aria-label={`${year}年12月1日から25日のカレンダー`}>
        {/* 日曜始まりの列に1日を合わせるため、月初の曜日の数だけ空セルを置く。 */}
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`blank-${i}`} className="calendar-blank" aria-hidden="true" />)}
        {Array.from({ length: 25 }, (_, i) => (
          <DayTag key={i + 1} year={year} day={i + 1} today={today}
            articles={articles.filter((article) => Number(article.date.slice(-2)) === i + 1)}
            selected={selectedDay === i + 1} onSelect={onSelectDay} />
        ))}
      </div>
    </section>
  );
}
