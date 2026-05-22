import * as Icons from 'lucide-react';
import { Award, Lock } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { BADGES } from '../data/badges';

export function BadgesScreen() {
  const { state } = useApp();
  const earnedIds = new Set(state.writer.achievements.map((a) => a.id));

  // Recompute earned client-side so the screen reflects latest state even if dispatch was skipped
  const computed = BADGES.map((b) => ({ def: b, earned: earnedIds.has(b.id) || b.check(state as any) }));
  const earned = computed.filter((c) => c.earned);
  const locked = computed.filter((c) => !c.earned);

  return (
    <div className="space-y-5 animate-slide-up">
      <header className="flex items-center gap-2">
        <Award size={20} className="text-gold" />
        <h1 className="font-display text-h1 font-semibold text-text">Achievements</h1>
        <span className="ml-2 text-caption text-text-muted">{earned.length}/{BADGES.length}</span>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...earned, ...locked].map(({ def, earned }) => {
          const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[def.icon] ?? Award;
          return (
            <div
              key={def.id}
              className={`rounded-xl p-4 text-center border transition-colors ${
                earned
                  ? 'bg-surface border-gold/30 shadow-card'
                  : 'bg-surface/40 border-white/5 opacity-50'
              }`}
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${earned ? 'bg-gold/15 text-gold' : 'bg-surface-2 text-text-faint'}`}>
                {earned ? <Icon size={22} /> : <Lock size={18} />}
              </div>
              <div className="font-display text-h3 font-semibold text-text text-caption leading-tight">{def.name}</div>
              <div className="text-micro text-text-faint mt-1 leading-snug">{def.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
