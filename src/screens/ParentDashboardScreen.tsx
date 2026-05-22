import { Settings as SettingsIcon, Coins, ChevronRight, Lock, LogOut, BookMarked } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useDailyCap } from '../hooks/useDailyCap';
import { Button } from '../components/ui/Button';
import { prettyDate } from '../utils/date';
import { tierLabel } from '../services/scoring';

const TIER_TEXT: Record<string, string> = {
  none: 'text-text-faint',
  bronze: 'text-tier-bronze',
  silver: 'text-tier-silver',
  gold: 'text-tier-gold',
  platinum: 'text-tier-platinum',
};

export function ParentDashboardScreen() {
  const { state, dispatch } = useApp();
  const cap = useDailyCap();
  const recent = [...state.entries].reverse().slice(0, 5);

  const week = state.entries.filter((e) => Date.now() - e.createdAt < 7 * 86_400_000);
  const month = state.entries.filter((e) => Date.now() - e.createdAt < 30 * 86_400_000);
  const avg = (arr: typeof state.entries) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((s, e) => s + e.judge.score, 0) / arr.length);

  return (
    <div className="space-y-5 animate-slide-up">
      <header>
        <div className="flex items-center gap-2 text-gold mb-1">
          <Lock size={14} />
          <span className="text-micro uppercase tracking-wider font-semibold">Parent mode</span>
        </div>
        <h1 className="font-display text-h1 font-semibold text-text">Parent dashboard</h1>
        <p className="text-text-muted text-caption mt-1">
          Auto-locks after 10 minutes of inactivity.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="text-micro text-text-faint uppercase tracking-wider mb-1">Pending</div>
          <div className="font-mono text-h1 font-semibold text-gold tabular-nums">${state.earnings.lifetimePending.toFixed(2)}</div>
        </div>
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="text-micro text-text-faint uppercase tracking-wider mb-1">Paid</div>
          <div className="font-mono text-h1 font-semibold text-text tabular-nums">${state.earnings.lifetimePaid.toFixed(2)}</div>
        </div>
      </section>

      <section className="bg-surface border border-white/5 rounded-xl p-4">
        <h2 className="font-display text-h3 font-semibold text-text mb-3">Activity</h2>
        <div className="grid grid-cols-3 gap-3 text-caption">
          <Stat label="Today" value={`$${cap.earnedToday.toFixed(2)}`} sub={`/ $${cap.cap.toFixed(2)}`} />
          <Stat label="This week" value={`${week.length}`} sub={`avg ${avg(week)}`} />
          <Stat label="This month" value={`${month.length}`} sub={`avg ${avg(month)}`} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-h3 font-semibold text-text">Recent entries</h2>
        {recent.length === 0 ? (
          <p className="text-caption text-text-muted py-4">No entries yet.</p>
        ) : (
          recent.map((e) => (
            <button
              key={e.id}
              onClick={() => dispatch({ type: 'NAV', screen: 'journal' })}
              className="w-full text-left bg-surface border border-white/5 rounded-xl p-3 hover:border-gold/30 transition-colors"
            >
              <div className="flex justify-between text-caption text-text-muted">
                <span className="truncate">{e.challengeTitle}</span>
                <span className="shrink-0">{prettyDate(e.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-micro mt-1">
                <span className={`uppercase tracking-wider font-semibold ${TIER_TEXT[e.judge.tier]}`}>
                  {tierLabel(e.judge.tier)}
                </span>
                <span className="text-text-faint">·</span>
                <span className="text-text-faint tabular-nums">{e.judge.score}/100 · {e.wordCount} words</span>
              </div>
            </button>
          ))
        )}
      </section>

      <section className="space-y-2">
        <ActionRow
          icon={<Coins size={18} />}
          label="Pay out pending earnings"
          onClick={() => dispatch({ type: 'NAV', screen: 'wallet' })}
          disabled={state.earnings.lifetimePending === 0}
        />
        <ActionRow
          icon={<BookMarked size={18} />}
          label="Read all entries"
          onClick={() => dispatch({ type: 'NAV', screen: 'journal' })}
        />
        <ActionRow
          icon={<SettingsIcon size={18} />}
          label="Settings"
          onClick={() => dispatch({ type: 'NAV', screen: 'settings' })}
        />
      </section>

      <Button
        variant="ghost"
        fullWidth
        onClick={() => {
          dispatch({ type: 'LOCK_PARENT' });
          dispatch({ type: 'NAV_RESET', screen: 'home' });
        }}
      >
        <LogOut size={16} /> Lock parent mode
      </Button>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-micro text-text-faint uppercase tracking-wider">{label}</div>
      <div className="font-mono text-h3 font-semibold text-text tabular-nums">{value}</div>
      {sub && <div className="text-micro text-text-faint tabular-nums">{sub}</div>}
    </div>
  );
}

function ActionRow({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-3 hover:border-gold/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
      <span className="bg-gold/15 text-gold rounded-lg p-2">{icon}</span>
      <span className="flex-1 font-medium text-text">{label}</span>
      <ChevronRight size={16} className="text-text-faint" />
    </button>
  );
}
