import { useEffect, useState } from 'react';

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Time-of-day greeting that refreshes every 15 minutes without reading the clock during render. */
export function useGreeting(): string {
  const [greeting, setGreeting] = useState(() => greetingFor(new Date().getHours()));
  useEffect(() => {
    const timer = window.setInterval(() => setGreeting(greetingFor(new Date().getHours())), 15 * 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return greeting;
}
