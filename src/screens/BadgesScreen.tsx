import type { CSSProperties } from 'react';
import { Award, BadgeDollarSign, Crown, Flame, Library, LockKeyhole, Map, Medal, NotebookPen, PenLine, Sparkles, Star, Target, Trophy, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { BADGES } from '../data/badges';
import { toneVars } from '../data/tones';
import { badgePercent, badgeProgress } from '../utils/progression';
import { prettyDate } from '../utils/date';
import { BadgeSeal } from '../components/art/BadgeSeal';
import { StarField } from '../components/art/StarField';
import { ProgressRing } from '../components/art/ProgressRing';

const BADGE_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Flame,
  Award,
  Trophy,
  Star,
  Medal,
  Crown,
  PenLine,
  NotebookPen,
  Library,
  Map,
  BadgeDollarSign,
  Wallet,
};

export function BadgesScreen() {
  const { state } = useApp();
  const earnedIds = new Set(state.writer.achievements.map((achievement) => achievement.id));
  const badgeState = { writer: state.writer, entries: state.entries, earnings: state.earnings };
  const computed = BADGES.map((def) => {
    const earned = earnedIds.has(def.id) || def.check(badgeState);
    const progress = badgeProgress(def.id, badgeState, def);
    return { def, earned, progress, unlockedAt: state.writer.achievements.find((achievement) => achievement.id === def.id)?.unlockedAt };
  });
  const earned = computed.filter((badge) => badge.earned);
  const locked = computed.filter((badge) => !badge.earned);
  const nextGoals = [...locked].sort((a, b) => badgePercent(b.progress) - badgePercent(a.progress)).slice(0, 3);
  const pct = BADGES.length > 0 ? (earned.length / BADGES.length) * 100 : 0;

  return (
    <div className="ws-page">
      <section className="ws-cabinet-hero ws-night ws-rise" aria-labelledby="badges-title">
        <StarField seed={17} count={36} sparkles={4} />
        <span className="ws-seal" style={{ width: '4.6rem', height: '4.6rem', margin: 0 }} aria-hidden="true">
          <BadgeSeal earned />
          <span className="ws-seal-icon"><Trophy size={26} /></span>
        </span>
        <div>
          <p className="ws-kicker">The achievement cabinet</p>
          <h1 id="badges-title" className="ws-h1">Badges &amp; milestones</h1>
          <p className="ws-lede">Every medallion is earned from something you actually wrote or did.</p>
        </div>
        <div className="ws-cabinet-count" style={toneVars('gold')}>
          <ProgressRing pct={pct} size={92} stroke={8} label={`${earned.length} of ${BADGES.length} badges earned`}>
            <span>
              <strong>{earned.length}</strong>
              <span>of {BADGES.length}</span>
            </span>
          </ProgressRing>
        </div>
      </section>

      {nextGoals.length > 0 && (
        <section aria-labelledby="next-goals-title" className="ws-rise" style={{ '--i': 1 } as CSSProperties}>
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker"><Target size={14} aria-hidden="true" /> Closest on the route</p>
              <h2 id="next-goals-title" className="ws-h2">Next achievable goals</h2>
            </div>
            <span className="ws-small">Based on your saved progress</span>
          </div>
          <div className="ws-goals">
            {nextGoals.map(({ def, progress }) => {
              const Icon = BADGE_ICONS[def.icon] ?? Award;
              const percent = badgePercent(progress);
              return (
                <div className="ws-card ws-goal" key={def.id} style={toneVars('gold')}>
                  <div className="ws-goal-head">
                    <span className="ws-medallion" aria-hidden="true"><Icon size={19} /></span>
                    <strong>{def.name}</strong>
                  </div>
                  <div className="ws-goal-detail"><span>{progress.detail}</span><span className="tabular">{percent}%</span></div>
                  <div className="ws-progress ws-progress--gold" role="progressbar" aria-label={`${def.name} progress`} aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={Math.min(progress.target, progress.current)}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="cabinet-title" className="ws-rise" style={{ '--i': 2 } as CSSProperties}>
        <div className="ws-section-head">
          <div>
            <p className="ws-kicker"><Medal size={14} aria-hidden="true" /> Collectible seals</p>
            <h2 id="cabinet-title" className="ws-h2">Your cabinet</h2>
          </div>
          <span className="ws-small">{earned.length} {earned.length === 1 ? 'seal' : 'seals'} earned</span>
        </div>
        <div className="ws-badge-grid">
          {[...earned, ...locked].map(({ def, earned: isEarned, progress, unlockedAt }) => {
            const Icon = BADGE_ICONS[def.icon] ?? Award;
            const percent = badgePercent(progress);
            return (
              <article className={`ws-card ws-badge ${isEarned ? 'is-earned' : ''}`} key={def.id}>
                <span className="ws-seal" aria-hidden="true">
                  <BadgeSeal earned={isEarned} />
                  <span className="ws-seal-icon">{isEarned ? <Icon size={26} /> : <LockKeyhole size={20} />}</span>
                </span>
                <h3 className="ws-badge-name">{def.name}</h3>
                <p className="ws-badge-desc m-0">{def.desc}</p>
                {isEarned ? (
                  <span className="ws-badge-date">{unlockedAt ? `Unlocked ${prettyDate(unlockedAt)}` : 'Earned from your writing'}</span>
                ) : (
                  <div className="ws-badge-progress">
                    <div className="ws-badge-progress-copy"><span>{progress.detail}</span><span>{percent}%</span></div>
                    <div className="ws-progress ws-progress--thin ws-progress--gold" role="progressbar" aria-label={`${def.name} progress`} aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={Math.min(progress.target, progress.current)}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
