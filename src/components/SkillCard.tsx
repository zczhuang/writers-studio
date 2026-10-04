import { BookOpen, Check, PenLine, ShieldCheck } from 'lucide-react';
import type { SkillCard as SkillCardData } from '../data/skillCards';
import { DIMENSIONS } from '../data/dimensionTheme';

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

function tint(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
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
    <article
      className="rounded-xl bg-surface border shadow-card overflow-hidden animate-fade-in"
      style={{ borderColor: status === 'mastered' ? tint(dim.color, 60) : tint(dim.color, 35) }}
    >
      {status && (
        <div
          className="float-right mt-4 mr-4 inline-flex items-center gap-1 text-micro uppercase tracking-wide font-sans font-semibold rounded-full px-2 py-0.5"
          style={{ color: dim.color, backgroundColor: tint(dim.color, 14) }}
        >
          {status === 'mastered' ? <Check size={11} /> : null}
          {status === 'mastered' ? 'Mastered' : 'Practiced'}
        </div>
      )}
      {/* Header: dimension glyph + title + source */}
      <header className="flex items-start gap-3 p-5 pb-3">
        <span
          className="shrink-0 rounded-lg p-2"
          style={{ color: dim.color, backgroundColor: tint(dim.color, 15) }}
        >
          <Glyph size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-h3 font-semibold text-text leading-tight">{card.title}</h3>
            <span
              className="text-micro uppercase tracking-wide font-sans font-semibold rounded-full px-2 py-0.5"
              style={{ color: dim.color, backgroundColor: tint(dim.color, 12) }}
            >
              {dim.kidLabel}
            </span>
          </div>
          <p className="text-text-faint text-caption mt-0.5">
            {card.source === 'classic' ? 'A classic master' : 'A modern master'} · {card.author}
            {card.work ? ` — ${card.work}` : ''}
          </p>
        </div>
      </header>

      {/* Mentor note — the "why" */}
      <p className="px-5 text-text-muted text-body leading-relaxed">{card.mentorNote}</p>

      {/* Model — the example, on "paper" */}
      <div className="px-5 mt-4">
        <div className="bg-paper text-ink rounded-lg p-4 shadow-paper font-serif">
          {ex.before && (
            <p className="text-ink-muted line-through decoration-rust/50 mb-1.5">{ex.before}</p>
          )}
          <p className="text-ink">{ex.after}</p>
        </div>
      </div>

      {/* Try — the micro-drill */}
      <div className="m-5 mt-4 rounded-lg p-4" style={{ backgroundColor: tint(dim.color, 9) }}>
        <div className="flex items-center gap-2 text-text font-sans font-semibold text-caption uppercase tracking-wide">
          <PenLine size={14} style={{ color: dim.color }} />
          Try it
        </div>
        <p className="text-text-muted text-body mt-1.5 leading-relaxed">{card.microDrill}</p>
        {onTryDrill && (
          <button
            onClick={onTryDrill}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gold text-ink font-sans font-semibold text-caption px-3 py-2 hover:bg-gold-bright transition-colors active:scale-[0.98]"
          >
            <PenLine size={14} /> {actionLabel ?? 'Practice this'}
          </button>
        )}
      </div>

      {/* Attribution footnote */}
      {!compact && (
        <footer className="px-5 pb-4 -mt-2 flex items-center gap-1.5 text-text-faint text-micro">
          {card.source === 'classic' ? (
            <>
              <BookOpen size={12} /> Public-domain text — free to read and learn from.
            </>
          ) : card.verified ? (
            <>
              <ShieldCheck size={12} /> Technique taught in our own words.
            </>
          ) : (
            <>
              <BookOpen size={12} /> A technique many writers share.
            </>
          )}
        </footer>
      )}
    </article>
  );
}
