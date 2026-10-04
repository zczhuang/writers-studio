import { useEffect, useState } from 'react';
import { todayISO } from '../../utils/date';

/** Keeps date-derived UI correct across a local midnight without reading the clock during render. */
export function useLocalToday(): string {
  const [today, setToday] = useState(() => todayISO());

  useEffect(() => {
    let timer = 0;

    const scheduleNextCheck = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = Math.max(1_000, nextMidnight.getTime() - now.getTime() + 50);
      timer = window.setTimeout(() => {
        setToday(todayISO());
        scheduleNextCheck();
      }, delay);
    };

    scheduleNextCheck();
    return () => window.clearTimeout(timer);
  }, []);

  return today;
}
