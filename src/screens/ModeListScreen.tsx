import * as Icons from 'lucide-react';
import { CheckCircle2, Circle, ChevronRight, PenLine } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { MODE_META, POOLS } from '../data/prompts';

export function ModeListScreen() {
  const { state, dispatch } = useApp();
  if (!state.currentMode) {
    dispatch({ type: 'NAV_RESET', screen: 'home' });
    return null;
  }
  const mode = state.currentMode;
  const meta = MODE_META[mode];
  const list = POOLS[mode];
  const completedIds = new Set(state.entries.filter((e) => e.mode === mode).map((e) => e.challengeId));
  const ModeIcon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ?? PenLine;

  return (
    <div className="space-y-5 animate-slide-up">
      <header className="flex items-start gap-3">
        <span className="bg-gold/15 text-gold rounded-lg p-2 shrink-0">
          <ModeIcon size={22} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-semibold text-text leading-tight">
            {meta.label} <span className="text-text-muted font-normal">prompts</span>
          </h1>
          <p className="text-text-muted text-caption mt-1">{meta.tagline}</p>
        </div>
      </header>

      <div className="space-y-2">
        {list.map((c) => {
          const done = completedIds.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => {
                dispatch({ type: 'PICK_CHALLENGE', challengeId: c.id });
                dispatch({ type: 'NAV', screen: 'write' });
              }}
              className="w-full text-left bg-surface border border-white/5 rounded-xl p-4 hover:border-gold/30 transition-colors flex items-center gap-3 group"
            >
              <span className={done ? 'text-moss' : 'text-text-faint'}>
                {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display text-h3 font-semibold text-text mb-0.5">{c.title}</div>
                <div className="text-caption text-text-muted">
                  <span className="text-gold">{c.skill}</span>
                  <span className="text-text-faint"> · {c.targetWords[0]}–{c.targetWords[1]} words</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-text-faint group-hover:text-gold transition-colors shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
