import type { CSSProperties } from 'react';
import { Check, Feather, LockKeyhole, Map } from 'lucide-react';
import { LEVELS } from '../../data/levels';
import { rankSnapshot } from '../../utils/progression';
import { LEVEL_ICONS } from './levelIcons';
import { toneVars } from '../../data/tones';

export function AdventureTrail({ xp }: { xp: number }) {
  const rank = rankSnapshot(xp);
  const currentIndex = LEVELS.findIndex((level) => level.id === rank.level.id);

  return (
    <section className="ws-card ws-card-pad ws-trail-card" aria-labelledby="adventure-trail-title">
      <div className="ws-section-head">
        <div>
          <p className="ws-kicker"><Map size={14} aria-hidden="true" /> The route so far</p>
          <h2 id="adventure-trail-title" className="ws-h2">Adventure trail</h2>
        </div>
        <span className="ws-chip tabular" style={toneVars('gold')}>
          {xp.toLocaleString()} XP
        </span>
      </div>
      <ol className="ws-trail" aria-label="Writing rank progression">
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
              className={`ws-trail-stop ${completed ? 'is-complete' : ''} ${current ? 'is-current' : ''} ${locked ? 'is-locked' : ''}`}
              aria-current={current ? 'step' : undefined}
              aria-label={`${level.name}, ${stateLabel}${unlockLabel}`}
              style={current ? ({ '--pct': Math.round(rank.pct) } as CSSProperties) : undefined}
            >
              <div className="ws-trail-node-wrap">
                {index < LEVELS.length - 1 && (
                  <span className="ws-trail-road" aria-hidden="true">
                    <span style={{ width: `${fill}%` }} />
                  </span>
                )}
                <span className="ws-trail-node" aria-hidden="true">
                  {completed ? <Check size={20} strokeWidth={2.6} /> : locked ? <LockKeyhole size={16} /> : <Icon size={19} />}
                </span>
              </div>
              <span className="ws-trail-name">{level.name}</span>
              <span className="ws-trail-meta">
                {locked ? `${level.min.toLocaleString()} XP` : current ? `${Math.round(rank.pct)}% there` : 'Complete'}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
