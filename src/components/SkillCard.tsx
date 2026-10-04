import { BookOpen, Check, PenLine, ShieldCheck } from 'lucide-react';
import type { SkillCard as SkillCardData } from '../data/skillCards';
import { DIMENSIONS } from '../data/dimensionTheme';
import { toneVars } from '../data/tones';

interface Props {
  card: SkillCardData;
  /** When provided, renders the action button. */
  onTryDrill?: () => void;
  /** Action button label (defaults to "Practice this"). */
  actionLabel?: string;
  /** Progress badge shown in the header. */
  status?: 'practiced' | 'mastered';
  /** Tighter layout for list/recommendation contexts. */
  compact?: boolean;
}

/** Splits a "before → after" example into its two halves, if present. */
function splitExample(example: string): { before?: string; after: string } {
  const arrow = example.includes('→') ? '→' : example.includes('->') ? '->' : null;
  if (!arrow) return { after: example };
  const idx = example.indexOf(arrow);
  return { before: example.slice(0, idx).trim(), after: example.slice(idx + arrow.length).trim() };
}

export function SkillCard({ card, onTryDrill, actionLabel, status, compact = false }: Props) {
  const dim = DIMENSIONS[card.dimension];
  const Glyph = dim.Glyph;
  const ex = splitExample(card.example);

  return (
    <article className={`ws-card ws-skill ${status === 'mastered' ? 'is-mastered' : ''}`} style={toneVars(card.dimension)}>
      <header className="ws-skill-head">
        <span className="ws-medallion ws-medallion--solid" aria-hidden="true"><Glyph size={20} /></span>
        <div className="ws-skill-head-copy">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="ws-skill-title">{card.title}</h3>
          </div>
          <p className="ws-skill-author">
            {card.source === 'classic' ? 'A classic master' : 'A modern master'} · {card.author}
            {card.work ? ` · ${card.work}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="ws-chip">{dim.kidLabel}</span>
            {status && (
              <span className="ws-chip ws-chip--solid">
                {status === 'mastered' ? <Check size={12} aria-hidden="true" /> : null}
                {status === 'mastered' ? 'Mastered' : 'Practiced'}
              </span>
            )}
          </div>
        </div>
      </header>

      <p className="ws-skill-note">{card.mentorNote}</p>

      <div className="ws-skill-example">
        {ex.before && <p className="is-before">{ex.before}</p>}
        <p className="is-after">{ex.after}</p>
      </div>

      <div className="ws-skill-drill">
        <div className="ws-skill-drill-label"><PenLine size={14} aria-hidden="true" /> Try it</div>
        <p>{card.microDrill}</p>
        {onTryDrill && (
          <button type="button" onClick={onTryDrill} className="ws-btn ws-btn--gold ws-btn--sm mt-3">
            <PenLine size={15} aria-hidden="true" /> {actionLabel ?? 'Practice this'}
          </button>
        )}
      </div>

      {!compact && (
        <footer className="ws-skill-foot">
          {card.source === 'classic' ? (
            <><BookOpen size={13} aria-hidden="true" /> Public-domain text, free to read and learn from.</>
          ) : card.verified ? (
            <><ShieldCheck size={13} aria-hidden="true" /> Technique taught in our own words.</>
          ) : (
            <><BookOpen size={13} aria-hidden="true" /> A technique many writers share.</>
          )}
        </footer>
      )}
    </article>
  );
}
