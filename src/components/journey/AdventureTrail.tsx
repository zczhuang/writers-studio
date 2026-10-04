import { BookOpen, Check, Feather, LockKeyhole, PenTool, Quote, Wand } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LEVELS } from '../../data/levels';
import { rankSnapshot } from '../../utils/progression';

const LEVEL_ICONS: Record<string, LucideIcon> = {
  Feather,
  Quote,
  Wand,
  BookOpen,
  PenTool,
};

export function AdventureTrail({ xp }: { xp: number }) {
  const rank = rankSnapshot(xp);
  const currentIndex = LEVELS.findIndex((level) => level.id === rank.level.id);

  return (
    <section className="atlas-trail-section" aria-labelledby="adventure-trail-title">
      <div className="atlas-section-heading">
        <div>
          <p className="atlas-kicker">The route so far</p>
          <h2 id="adventure-trail-title" className="atlas-heading atlas-heading-small">Adventure trail</h2>
        </div>
        <span className="atlas-caption">{rank.level.name} rank</span>
      </div>
      <ol className="atlas-trail" aria-label="Writing rank progression">
        {LEVELS.map((level, index) => {
          const Icon = LEVEL_ICONS[level.icon] ?? Feather;
          const completed = index < currentIndex;
          const current = index === currentIndex;
          const locked = index > currentIndex;
          const fill = completed ? 100 : current ? rank.pct : 0;
          const stateLabel = completed ? 'Completed rank' : current ? 'Current rank' : 'Locked rank';
          const unlockLabel = locked ? `, unlocks at ${level.min.toLocaleString()} XP` : '';
          return (
            <li
              key={level.id}
              className={`atlas-trail-stop ${completed ? 'is-complete' : ''} ${current ? 'is-current' : ''} ${locked ? 'is-locked' : ''}`}
              aria-current={current ? 'step' : undefined}
              aria-label={`${level.name}, ${stateLabel}${unlockLabel}`}
            >
              <div className="atlas-trail-node-wrap">
                <span className="atlas-trail-node" aria-hidden="true">
                  {completed ? <Check size={14} strokeWidth={2.5} /> : locked ? <LockKeyhole size={13} /> : <Icon size={15} />}
                </span>
                {index < LEVELS.length - 1 && (
                  <span className="atlas-trail-connector" aria-hidden="true">
                    <span style={{ width: `${fill}%` }} />
                  </span>
                )}
              </div>
              <span className="atlas-trail-label">{level.name}</span>
              <span className="atlas-trail-xp">
                {locked ? `${level.min.toLocaleString()} XP to unlock` : current ? `${Math.round(rank.pct)}% through` : 'Complete'}
              </span>
              <span className="sr-only">{stateLabel}{unlockLabel}.</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
