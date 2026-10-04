import { PenLine } from 'lucide-react';
import type { ActivityDay } from '../../utils/progression';

export function WeeklyActivity({ days }: { days: ActivityDay[] }) {
  const maxWords = Math.max(100, ...days.map((day) => day.words));
  const activeDays = days.filter((day) => day.entries > 0).length;

  return (
    <section className="atlas-panel" aria-labelledby="weekly-activity-title">
      <div className="atlas-section-heading">
        <div>
          <p className="atlas-kicker">A gentle look back</p>
          <h2 id="weekly-activity-title" className="atlas-heading atlas-heading-small">This week in words</h2>
        </div>
        <span className="atlas-caption">{activeDays}/7 writing days</span>
      </div>
      <figure className="atlas-activity-figure">
        <figcaption className="sr-only">Writing activity for the last seven local calendar days.</figcaption>
        <ul className="atlas-activity-strip" aria-label="Writing activity for the last seven local days">
          {days.map((day) => {
            const height = day.words > 0 ? Math.max(16, Math.round((day.words / maxWords) * 100)) : 8;
            const wordLabel = `${day.words} ${day.words === 1 ? 'word' : 'words'}`;
            const pieceLabel = `${day.entries} ${day.entries === 1 ? 'piece' : 'pieces'}`;
            return (
              <li
                className={`atlas-activity-day ${day.isToday ? 'is-today' : ''} ${day.words > 0 ? 'has-words' : ''}`}
                key={day.date}
                aria-label={`${day.label}, ${day.shortDate}: ${wordLabel}, ${pieceLabel}${day.isToday ? ', today' : ''}`}
              >
                <div className="atlas-activity-bar-wrap" title={`${wordLabel} and ${pieceLabel} on ${day.shortDate}`}>
                  <span className="atlas-activity-bar" style={{ height: `${height}%` }} aria-hidden="true" />
                </div>
                <span className="atlas-activity-label">{day.label.slice(0, 2)}</span>
                <span className="atlas-activity-date">{day.shortDate}</span>
                <span className="sr-only">{wordLabel}; {pieceLabel}.</span>
              </li>
            );
          })}
        </ul>
      </figure>
      <p className="atlas-supportive-note"><PenLine size={14} aria-hidden="true" />
        {activeDays === 7 ? 'A full week of pages. That rhythm is yours.' : activeDays === 0 ? 'No pages yet this week. Today is a clean place to begin.' : 'Every marked day counts. The blank days are just more map to explore.'}
      </p>
    </section>
  );
}
