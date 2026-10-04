import { Award, BadgeDollarSign, Crown, Flame, Library, LockKeyhole, Map, Medal, NotebookPen, PenLine, Sparkles, Star, Trophy, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { BADGES } from '../data/badges';
import { badgePercent, badgeProgress } from '../utils/progression';
import { prettyDate } from '../utils/date';

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

  return (
    <div className="atlas-page animate-slide-up">
      <header>
        <p className="atlas-kicker">The achievement cabinet</p>
        <h1 className="atlas-heading" id="badges-title">Badges &amp; milestones</h1>
      </header>

      <section className="atlas-badge-hero" aria-labelledby="badges-title">
        <span className="atlas-badge-hero-mark" aria-hidden="true"><Award size={25} /></span>
        <div>
          <h2 className="atlas-badge-hero-title">Keep the good marks.</h2>
          <p className="atlas-badge-hero-copy">Every medallion is earned from something you actually wrote or did.</p>
        </div>
        <span className="atlas-badge-hero-count">{earned.length}/{BADGES.length}</span>
      </section>

      {nextGoals.length > 0 && (
        <section aria-labelledby="next-goals-title">
          <div className="atlas-section-heading">
            <div>
              <p className="atlas-kicker">Closest on the route</p>
              <h2 id="next-goals-title" className="atlas-heading atlas-heading-small">Next achievable goals</h2>
            </div>
            <span className="atlas-caption">Based on your saved progress</span>
          </div>
          <div className="atlas-next-goals">
            {nextGoals.map(({ def, progress }) => (
              <div className="atlas-goal-card" key={def.id}>
                <strong>{def.name}</strong>
                <p>{progress.detail}</p>
                <div className="atlas-mini-track" role="progressbar" aria-label={`${def.name} progress`} aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={Math.min(progress.target, progress.current)}>
                  <span style={{ width: `${badgePercent(progress)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="cabinet-title">
        <div className="atlas-section-heading">
          <div>
            <p className="atlas-kicker">Collectible pages</p>
            <h2 id="cabinet-title" className="atlas-heading atlas-heading-small">Your cabinet</h2>
          </div>
          <span className="atlas-caption">{earned.length} distinct {earned.length === 1 ? 'medallion' : 'medallions'} earned</span>
        </div>
        <div className="atlas-badge-grid">
          {[...earned, ...locked].map(({ def, earned: isEarned, progress, unlockedAt }) => {
            const Icon = BADGE_ICONS[def.icon] ?? Award;
            return (
              <article className={`atlas-badge-card ${isEarned ? 'is-earned' : ''}`} key={def.id}>
                <span className="atlas-badge-medallion" aria-hidden="true">{isEarned ? <Icon size={24} /> : <LockKeyhole size={19} />}</span>
                <h3 className="atlas-badge-name">{def.name}</h3>
                <p className="atlas-badge-desc">{def.desc}</p>
                {isEarned && unlockedAt ? <span className="atlas-badge-date">Unlocked {prettyDate(unlockedAt)}</span> : !isEarned ? (
                  <div className="atlas-badge-progress">
                    <div className="atlas-badge-progress-copy"><span>{progress.detail}</span><span>{badgePercent(progress)}%</span></div>
                    <div className="atlas-mini-track" role="progressbar" aria-label={`${def.name} progress`} aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={Math.min(progress.target, progress.current)}><span style={{ width: `${badgePercent(progress)}%` }} /></div>
                  </div>
                ) : <span className="atlas-badge-date">Earned from your writing</span>}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
