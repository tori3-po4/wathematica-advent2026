import { useEffect, useState } from "react";
import { jstDate } from "../calendar.mjs";

/** 端末時計を監視し、日本時間の日付が変わったときに公開判定を更新する。 */
export function useCalendarDate() {
  // ビルド時の時計を採用しない。初回はnullで静的HTMLとReactの描画を一致させ、
  // useEffectが動くブラウザ上で初めて端末時計を読む（ハイドレーションの不一致を防ぐ）。
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => {
      const next = new Date();
      // 監視は毎秒でも、同じ日本日付なら同じDateを返し、不要な再描画を避ける。
      setNow((previous) => previous && jstDate(previous) === jstDate(next) ? previous : next);
    };
    const onVisible = () => { if (!document.hidden) refresh(); };
    refresh();
    // ページを開いたままの0時越えと、閲覧中の端末時計の変更を検知する。
    const timer = window.setInterval(refresh, 1000);
    // バックグラウンドでのタイマー抑制や履歴キャッシュからの復帰時も、すぐに日付を確認する。
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      // 再マウント時にタイマーやイベントリスナーが重複しないように後始末する。
      window.clearInterval(timer);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}
