import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { Lightbulb, Loader2, PenLine, Send } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { getChallenge, MODE_META } from '../data/prompts';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { WordCounter } from '../components/WordCounter';
import { useDraft } from '../hooks/useDraft';
import { countWords } from '../utils/text';
import { heuristicJudge } from '../services/heuristic';
import { judgeWriting, GeminiError, inCooldown } from '../services/gemini';
import { id as makeId } from '../utils/id';
import { tierToDollars } from '../services/scoring';
import { useDailyCap } from '../hooks/useDailyCap';
import type { Entry, JudgeResult, LedgerEntry, LedgerStatus } from '../types';
import { todayISO } from '../utils/date';
import { pushToast } from '../hooks/useToast';

export function WriteScreen() {
  const { state, dispatch } = useApp();
  const mode = state.currentMode;
  const cid = state.currentChallengeId;
  const challenge = useMemo(() => (mode && cid ? getChallenge(mode, cid) : undefined), [mode, cid]);
  const [draft, setDraft, clearDraft] = useDraft(challenge?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const cap = useDailyCap();

  useEffect(() => {
    if (!challenge) {
      dispatch({ type: 'NAV_RESET', screen: 'home' });
    }
  }, [challenge, dispatch]);

  if (!challenge || !mode) return null;
  const meta = MODE_META[mode];
  const ModeIcon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] ?? PenLine;
  const wc = countWords(draft);
  const [minTarget] = challenge.targetWords;
  const canSubmit = wc >= Math.max(10, Math.floor(minTarget * 0.5)) && !submitting;
  const capLocks = cap.capHit && state.settings.capBehavior === 'lock';

  const submit = async () => {
    if (!canSubmit || capLocks) return;
    setSubmitting(true);

    const key = state.settings.geminiApiKey?.trim();
    const useGemini = !!key && key.length > 20 && navigator.onLine && wc >= 15 && !inCooldown();
    let judge: JudgeResult;
    if (useGemini) {
      try {
        judge = await judgeWriting(
          draft.trim(),
          { mode, title: challenge.title, prompt: challenge.prompt },
          {
            apiKey: key,
            model: state.settings.geminiModel || 'gemini-3.1-flash-lite',
            audienceAge: state.settings.audienceAge,
          }
        );
      } catch (err) {
        if (err instanceof GeminiError) {
          if (err.status === 400 || err.status === 401 || err.status === 403) {
            pushToast('API key invalid — check Settings.', 'warn');
          } else if (err.status === 429) {
            pushToast('Coach is resting — used local scoring.', 'warn');
          } else {
            pushToast('Coach unavailable — used local scoring.', 'warn');
          }
        } else {
          pushToast('Coach didn\'t reply — used local scoring.', 'warn');
        }
        judge = heuristicJudge(draft, challenge);
      }
    } else {
      judge = heuristicJudge(draft, challenge);
    }
    const dollars = tierToDollars(judge.tier);

    // Determine ledger status based on cap
    let amount = dollars;
    let status: LedgerStatus = 'pending';
    if (state.settings.capBehavior === 'forfeit') {
      const fits = cap.remaining;
      if (amount > 0 && fits <= 0) {
        amount = 0;
        status = 'forfeited';
      } else if (amount > fits) {
        amount = Math.max(0, fits);
        if (amount === 0) status = 'forfeited';
      }
    }
    if (judge.tier === 'none') { amount = 0; status = 'forfeited'; }

    const entryId = makeId();
    const ledgerId = makeId();
    const now = Date.now();

    const entry: Entry = {
      id: entryId,
      date: todayISO(),
      createdAt: now,
      mode,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      prompt: challenge.prompt,
      text: draft.trim(),
      wordCount: wc,
      judge,
      earningsId: ledgerId,
    };

    const ledger: LedgerEntry = {
      id: ledgerId,
      entryId,
      amount,
      tier: judge.tier,
      status,
      createdAt: now,
    };

    dispatch({ type: 'SUBMIT_ENTRY', entry, ledger });
    clearDraft();
    if (status === 'forfeited' && judge.tier !== 'none') {
      pushToast('Daily cap reached — this one\'s for practice.', 'warn');
    }
    dispatch({ type: 'NAV_RESET', screen: 'result' });
    setSubmitting(false);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <header className="bg-gradient-to-br from-surface-2 to-surface rounded-2xl p-5 border border-white/5">
        <div className="flex items-center gap-2 text-text-faint text-micro uppercase tracking-wider mb-2">
          <ModeIcon size={14} className="text-gold" />
          <span>{meta.label}</span>
          <span className="text-text-faint/60">·</span>
          <span className="text-gold/90">{challenge.skill}</span>
        </div>
        <h1 className="font-display text-h1 font-semibold text-text mb-2 leading-tight">{challenge.title}</h1>
        {challenge.original && (
          <div className="bg-rust/10 border-l-2 border-rust rounded-r-md px-3 py-2 mb-3">
            <div className="text-micro text-rust uppercase tracking-wider mb-1">Boring original — make it shine</div>
            <p className="font-serif italic text-text">{challenge.original}</p>
          </div>
        )}
        <p className="font-serif text-text-muted leading-relaxed">{challenge.prompt}</p>
      </header>

      {challenge.questions && challenge.questions.length > 0 && (
        <section className="bg-gold/8 border border-gold/20 rounded-xl">
          <button
            onClick={() => setShowGuides((s) => !s)}
            className="w-full flex items-center gap-2 text-left px-4 py-3"
          >
            <Lightbulb size={16} className="text-gold" />
            <span className="font-display text-h3 font-semibold text-text">Think about…</span>
            <span className="ml-auto text-text-muted text-caption">{showGuides ? 'hide' : 'show'}</span>
          </button>
          {showGuides && (
            <ul className="px-4 pb-4 space-y-1.5 text-caption text-text-muted font-serif italic">
              {challenge.questions.map((q, i) => (
                <li key={i} className="flex gap-2"><span className="text-gold/70 shrink-0">·</span><span>{q}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="bg-paper-texture rounded-2xl shadow-paper border border-paper-edge p-5 sm:p-7">
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Begin here…"
          rows={10}
          spellCheck
        />
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink/10">
          <WordCounter count={wc} target={challenge.targetWords} />
          <span className="text-caption text-ink-muted italic">draft auto-saves</span>
        </div>
      </section>

      {capLocks && (
        <div className="bg-rust/12 border border-rust/30 rounded-xl p-3 text-caption text-text">
          You've earned today's max (${cap.cap.toFixed(2)}). Submissions resume tomorrow.
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="ghost"
          size="md"
          onClick={() => dispatch({ type: 'NAV_BACK' })}
          className="flex-1"
        >
          Save & exit
        </Button>
        <Button
          variant="gold"
          size="md"
          onClick={submit}
          disabled={!canSubmit || capLocks}
          className="flex-[2]"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
          {submitting ? 'Reading…' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
