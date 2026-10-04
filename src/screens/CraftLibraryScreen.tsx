import { useState, type CSSProperties } from 'react';
import { BookOpenCheck, Library, Sparkles } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { SKILL_CARDS } from '../data/skillCards';
import type { JudgeBreakdown } from '../types';
import { DIMENSIONS, DIMENSION_ORDER } from '../data/dimensionTheme';
import { toneVars } from '../data/tones';
import { recommendSkill } from '../services/writerMemory';
import { SkillCard } from '../components/SkillCard';
import { pushToast } from '../hooks/useToast';

type Filter = 'all' | keyof JudgeBreakdown;

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
    <div className="ws-page">
      <header className="ws-page-head ws-rise">
        <div>
          <p className="ws-kicker"><Library size={14} aria-hidden="true" /> Learn from great writers</p>
          <h1 className="ws-h1">Craft library</h1>
          <p className="ws-lede">One trick at a time, from classic and modern masters. Try it, then weave it into your next piece.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
          <span className="ws-medallion" style={toneVars('success')} aria-hidden="true"><BookOpenCheck size={20} /></span>
          <div>
            <div className="font-display text-[1.6rem] font-semibold leading-none tabular-nums">{mastered.size}/{SKILL_CARDS.length}</div>
            <div className="mt-1 text-[0.8rem] font-bold text-text-muted">skills mastered · {practiced.size} tried</div>
          </div>
        </div>
      </header>

      {recommended && (
        <section className="ws-rise" style={{ '--i': 1 } as CSSProperties} aria-labelledby="recommended-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker"><Sparkles size={14} aria-hidden="true" /> Picked for you</p>
              <h2 id="recommended-title" className="ws-h2">
                Recommended
                {state.memory.growthEdge && (
                  <span className="font-normal text-text-muted"> · builds your {DIMENSIONS[state.memory.growthEdge].kidLabel.toLowerCase()}</span>
                )}
              </h2>
            </div>
          </div>
          <SkillCard
            card={recommended}
            status={statusOf(recommended.id)}
            onTryDrill={() => {
              dispatch({ type: 'MARK_SKILL_PRACTICED', id: recommended.id });
              pushToast('Nice! Now weave it into your next piece.', 'success');
            }}
          />
        </section>
      )}

      <section className="ws-rise" style={{ '--i': 2 } as CSSProperties} aria-labelledby="all-skills-title">
        <div className="ws-section-head">
          <div>
            <p className="ws-kicker">Browse by skill</p>
            <h2 id="all-skills-title" className="ws-h2">All craft cards</h2>
          </div>
          <span className="ws-small tabular">{list.length} cards</span>
        </div>
        <div className="ws-filter-row" role="group" aria-label="Filter by skill" style={{ marginBottom: '1rem' }}>
          <button type="button" onClick={() => setFilter('all')} className={`ws-filter ${filter === 'all' ? 'is-active' : ''}`} aria-pressed={filter === 'all'}>
            All
          </button>
          {DIMENSION_ORDER.map((d) => {
            const theme = DIMENSIONS[d];
            const active = filter === d;
            return (
              <button key={d} type="button" onClick={() => setFilter(d)} className={`ws-filter ${active ? 'is-active' : ''}`} style={toneVars(d)} aria-pressed={active}>
                <theme.Glyph size={15} aria-hidden="true" />
                {theme.kidLabel}
              </button>
            );
          })}
        </div>
        <div className="ws-craft-grid">
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
      </section>
    </div>
  );
}
