import { useState } from 'react';
import { Library, Sparkles } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { SKILL_CARDS } from '../data/skillCards';
import type { JudgeBreakdown } from '../types';
import { DIMENSIONS, DIMENSION_ORDER } from '../data/dimensionTheme';
import { recommendSkill } from '../services/writerMemory';
import { SkillCard } from '../components/SkillCard';
import { pushToast } from '../hooks/useToast';

type Filter = 'all' | keyof JudgeBreakdown;

function tint(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function CraftLibraryScreen() {
  const { state, dispatch } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const mastered = new Set(state.craft.masteredSkills);
  const practiced = new Set(state.craft.practicedSkills);
  const recommended = recommendSkill(state.memory, state.craft.masteredSkills);

  const list = SKILL_CARDS.filter((c) => filter === 'all' || c.dimension === filter);

  const statusOf = (id: string): 'mastered' | 'practiced' | undefined =>
    mastered.has(id) ? 'mastered' : practiced.has(id) ? 'practiced' : undefined;

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="flex items-start gap-3">
        <span className="bg-gold/15 text-gold rounded-lg p-2 shrink-0">
          <Library size={22} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-semibold text-text leading-tight">Craft Library</h1>
          <p className="text-text-muted text-caption mt-1">
            One trick at a time, learned from the great writers — classic and modern.
          </p>
        </div>
      </header>

      {/* Recommended for you */}
      {recommended && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-gold" />
            <h2 className="font-display text-h3 font-semibold text-text">
              Recommended for you
              {state.memory.growthEdge && (
                <span className="text-text-muted font-normal">
                  {' '}· builds your {DIMENSIONS[state.memory.growthEdge].kidLabel.toLowerCase()}
                </span>
              )}
            </h2>
          </div>
          <SkillCard
            card={recommended}
            status={statusOf(recommended.id)}
            onTryDrill={() => {
              dispatch({ type: 'MARK_SKILL_PRACTICED', id: recommended.id });
              pushToast('Nice — now weave it into your next piece!', 'success');
            }}
          />
        </section>
      )}

      {/* Dimension filter */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterChip>
        {DIMENSION_ORDER.map((d) => {
          const theme = DIMENSIONS[d];
          const active = filter === d;
          return (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-sans font-semibold transition-colors border"
              style={{
                color: active ? 'var(--bg)' : theme.color,
                backgroundColor: active ? theme.color : tint(theme.color, 12),
                borderColor: tint(theme.color, 40),
              }}
            >
              <theme.Glyph size={13} />
              {theme.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4">
        {list.map((c) => {
          const st = statusOf(c.id);
          return (
            <SkillCard
              key={c.id}
              card={c}
              compact
              status={st}
              actionLabel={st === 'mastered' ? undefined : "I've got this"}
              onTryDrill={
                st === 'mastered'
                  ? undefined
                  : () => {
                      dispatch({ type: 'MARK_SKILL_MASTERED', id: c.id });
                      pushToast(`"${c.title}" added to your mastered skills.`, 'success');
                    }
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-caption font-sans font-semibold border transition-colors ${
        active ? 'bg-gold text-ink border-gold' : 'bg-surface text-text-muted border-line-2 hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
