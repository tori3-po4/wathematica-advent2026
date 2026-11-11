import { useEffect, useState } from "react";
import { jstDate } from "../calendar.mjs";

export function useCalendarDate() {
  // The build and first client render agree; publication uses the reader's clock.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => {
      const next = new Date();
      setNow((previous) => previous && jstDate(previous) === jstDate(next) ? previous : next);
    };
    const onVisible = () => { if (!document.hidden) refresh(); };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}
