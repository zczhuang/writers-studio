import { CalendarDays, Feather } from 'lucide-react';
import type { ActivityDay } from '../../utils/progression';

export function WeeklyActivity({ days }: { days: ActivityDay[] }) {
  const maxWords = Math.max(100, ...days.map((day) => day.words));
  const activeDays = days.filter((day) => day.entries > 0).length;
  const totalWords = days.reduce((sum, day) => sum + day.words, 0);

  return (
    <section className="ws-card ws-card-pad" aria-labelledby="weekly-activity-title">
      <div className="ws-section-head">
        <div>
          <p className="ws-kicker"><CalendarDays size={14} aria-hidden="true" /> A gentle look back</p>
          <h2 id="weekly-activity-title" className="ws-h2">This week in words</h2>
        </div>
        <div className="text-right">
          <div className="font-display text-[1.6rem] font-semibold leading-none tabular-nums text-ink">{totalWords.toLocaleString()}</div>
          <div className="mt-1 text-[0.78rem] font-bold text-text-muted">{activeDays}/7 writing days</div>
        </div>
      </div>
      <figure className="m-0">
        <figcaption className="sr-only">Writing activity for the last seven local calendar days.</figcaption>
        <ul className="ws-week" aria-label="Writing activity for the last seven local days">
          {days.map((day, index) => {
            const height = day.words > 0 ? Math.max(14, Math.round((day.words / maxWords) * 100)) : 6;
            const wordLabel = `${day.words} ${day.words === 1 ? 'word' : 'words'}`;
            const pieceLabel = `${day.entries} ${day.entries === 1 ? 'piece' : 'pieces'}`;
            return (
              <li
                className={`ws-week-day ${day.isToday ? 'is-today' : ''} ${day.words > 0 ? 'has-words' : ''}`}
                key={day.date}
                aria-label={`${day.label}, ${day.shortDate}: ${wordLabel}, ${pieceLabel}${day.isToday ? ', today' : ''}`}
              >
                <div className="ws-week-col" title={`${wordLabel} and ${pieceLabel} on ${day.shortDate}`}>
                  {day.words > 0 && <span className="ws-week-value" aria-hidden="true">{day.words}</span>}
                  <span className="ws-week-bar" style={{ height: `${height}%`, animationDelay: `${index * 60}ms` }} aria-hidden="true" />
                </div>
                <span className="ws-week-label">{day.isToday ? 'Today' : day.label.slice(0, 3)}</span>
                <span className="ws-week-date">{day.shortDate}</span>
              </li>
            );
          })}
        </ul>
      </figure>
      <p className="ws-note"><Feather size={15} aria-hidden="true" />
        {activeDays === 7 ? 'A full week of pages. That rhythm is yours.' : activeDays === 0 ? 'No pages yet this week. Today is a clean place to begin.' : 'Every marked day counts. The blank days are just more map to explore.'}
      </p>
    </section>
  );
}
