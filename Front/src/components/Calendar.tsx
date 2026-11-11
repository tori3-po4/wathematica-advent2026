// Adapted from the 2025 Calendar. See THIRD_PARTY_NOTICES.md.
import DayTag from "./DayTag";
import type { Article } from "../types";

interface Props {
  year: number;
  articles: Article[];
  today: string | null;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
}

export default function Calendar({ year, articles, today, selectedDay, onSelectDay }: Props) {
  const firstWeekday = new Date(Date.UTC(year, 11, 1)).getUTCDay();
  return (
    <section id="calendar" aria-labelledby="calendar-heading">
      <h2 id="calendar-heading">{year}年12月</h2>
      <p>日付を選ぶと記事を表示します。各日0:00公開（日本時間）。</p>
      <ul className="weekdays" aria-hidden="true">
        {["日", "月", "火", "水", "木", "金", "土"].map((day) => <li key={day}>{day}</li>)}
      </ul>
      <div className="calendar-grid" aria-label={`${year}年12月1日から25日のカレンダー`}>
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
