import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Eye, Feather, Lightbulb, Loader2, Pen, Send, Sparkles, Target, Wand } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { getChallenge, MODE_META } from '../data/prompts';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { useDraft } from '../hooks/useDraft';
import { countWords } from '../utils/text';
import { heuristicJudge } from '../services/heuristic';
import { judgeWriting, GeminiError, inCooldown } from '../services/gemini';
import { coachContext } from '../services/writerMemory';
import { id as makeId } from '../utils/id';
import { useDailyCap } from '../hooks/useDailyCap';
import type { Entry, JudgeBreakdown, JudgeResult, LedgerEntry, Mode } from '../types';
import { isoFromTimestamp } from '../utils/date';
import { pushToast } from '../hooks/useToast';
import { DIMENSIONS, DIMENSION_ORDER } from '../data/dimensionTheme';
import {
  MAX_REVISIONS,
  canReviseEntry,
  getRevisionRewardAvailability,
  resolveRevisionReward,
  type RevisionRewardAvailability,
  type RevisionRewardDecision,
} from '../services/revision';
import { resolveFreshReward, timestampForLocalDay } from '../services/dailyCap';

const MODE_ICONS: Record<Mode, LucideIcon> = {
  scene: Eye,
  story: BookOpen,
  mystery: Wand,
  upgrade: Pen,
};

function lowestDimension(breakdown: JudgeBreakdown): keyof JudgeBreakdown {
  let edge = DIMENSION_ORDER[0];
  for (const dimension of DIMENSION_ORDER) {
    if (breakdown[dimension] < breakdown[edge]) edge = dimension;
  }
  return edge;
}

function practiceOnlyMessage(availability: RevisionRewardAvailability): string | null {
  switch (availability) {
    case 'already-paid':
      return 'This piece was already paid. Revise for practice and +8 XP.';
    case 'forfeited':
    case 'older-day':
    case 'missing-ledger':
      return 'Revise for practice and +8 XP. Your original reward stays the same.';
    case 'eligible':
      return null;
  }
}

function revisionToast(decision: RevisionRewardDecision): void {
  if (decision.rewardChanged) {
    pushToast(`Revision saved. You earned $${decision.addedAmount.toFixed(2)} more and +8 XP.`, 'success');
    return;
  }

  if (decision.reason === 'cap-reached') {
    pushToast('Revision saved for +8 XP. Your original reward stays the same.', 'warn');
    return;
  }

  if (decision.reason === 'not-higher-tier') {
    pushToast('Revision saved for +8 XP. You kept your best reward.', 'success');
    return;
  }

  if (decision.reason === 'already-paid') {
    pushToast('This piece was already paid. Revision saved for practice and +8 XP.', 'success');
    return;
  }

  pushToast('Revision saved for practice and +8 XP. Your original reward stays the same.', 'success');
}

export function WriteScreen() {
  const { state, dispatch } = useApp();
  const mode = state.currentMode;
  const challengeId = state.currentChallengeId;
  const challenge = useMemo(
    () => (mode && challengeId ? getChallenge(mode, challengeId) : undefined),
    [mode, challengeId]
  );
  const [draft, setDraft, clearDraft] = useDraft(challenge?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const fieldId = useId();
  const cap = useDailyCap();
  const presentationNow = useMemo(() => timestampForLocalDay(cap.localDay), [cap.localDay]);
  const latestStateRef = useRef(state);
  const mountedRef = useRef(true);
  const submissionTokenRef = useRef(0);
  const submittingRef = useRef(false);

  const revising = state.revisingEntryId
    ? state.entries.find((entry) => entry.id === state.revisingEntryId) ?? null
    : null;
  const [revisionText, setRevisionText] = useState(() => revising?.text ?? '');

  useLayoutEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submittingRef.current = false;
      submissionTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!challenge) dispatch({ type: 'NAV_RESET', screen: 'home' });
  }, [challenge, dispatch]);

  if (!challenge || !mode) return null;

  const meta = MODE_META[mode];
  const ModeIcon = MODE_ICONS[mode];
  const text = revising ? revisionText : draft;
  const setText = revising ? setRevisionText : setDraft;
  const targetDimension = revising ? lowestDimension(revising.judge.breakdown) : null;
  const revisionLedger = revising
    ? state.earnings.ledger.find((row) => row.id === revising.earningsId)
    : undefined;
  const revisionAvailability = revising
    ? getRevisionRewardAvailability(revisionLedger, presentationNow)
    : null;
  const practiceMessage = revisionAvailability ? practiceOnlyMessage(revisionAvailability) : null;
  const revisionLimitReached = !!revising && !canReviseEntry(revising);

  const wordCount = countWords(text);
  const [minTarget, maxTarget] = challenge.targetWords;
  const submissionFloor = Math.max(10, Math.floor(minTarget * 0.5));
  const hasEnoughWords = wordCount >= submissionFloor;
  const canSubmit = hasEnoughWords && !submitting && !revisionLimitReached;
  const capLocks = cap.capHit && state.settings.capBehavior === 'lock' && !revising;

  const headingId = `${fieldId}-heading`;
  const guideId = `${fieldId}-guides`;
  const draftHeadingId = `${fieldId}-draft-heading`;
  const draftLabelId = `${fieldId}-draft-label`;
  const textareaId = `${fieldId}-textarea`;
  const writingGuidanceId = `${fieldId}-writing-guidance`;
  const wordGoalId = `${fieldId}-word-goal`;

  const submissionIsCurrent = (token: number, revisionId: string | null) => {
    const latest = latestStateRef.current;
    return (
      mountedRef.current &&
      submissionTokenRef.current === token &&
      latest.screen === 'write' &&
      latest.currentMode === mode &&
      latest.currentChallengeId === challenge.id &&
      latest.revisingEntryId === revisionId
    );
  };

  const finishSubmission = (token: number) => {
    if (submissionTokenRef.current !== token) return;
    submittingRef.current = false;
    if (mountedRef.current) setSubmitting(false);
  };

  const submit = async () => {
    if (revising && !canReviseEntry(revising)) {
      pushToast('This piece already has two completed revisions.', 'warn');
      return;
    }
    if (!canSubmit || capLocks || submittingRef.current) return;

    submittingRef.current = true;
    const token = ++submissionTokenRef.current;
    const revisionId = revising?.id ?? null;
    const submittedText = text.trim();
    const submittedWordCount = wordCount;
    setSubmitting(true);

    const key = state.settings.geminiApiKey?.trim();
    const useGemini = !!key && key.length > 20 && navigator.onLine && wordCount >= 15 && !inCooldown();
    let judge: JudgeResult;
    let scoringNotice: string | null = null;
    if (useGemini) {
      try {
        judge = await judgeWriting(
          submittedText,
          { mode, title: challenge.title, prompt: challenge.prompt },
          {
            apiKey: key,
            model: state.settings.geminiModel || 'gemini-3.1-flash-lite',
            audienceAge: state.settings.audienceAge,
            coachContext: coachContext(state.memory, mode),
          }
        );
      } catch (error) {
        if (error instanceof GeminiError) {
          if (error.status === 400 || error.status === 401 || error.status === 403) {
            scoringNotice = 'API key invalid — check Settings.';
          } else if (error.status === 429) {
            scoringNotice = 'Coach is resting — used local scoring.';
          } else {
            scoringNotice = 'Coach unavailable — used local scoring.';
          }
        } else {
          scoringNotice = 'Coach didn’t reply — used local scoring.';
        }
        judge = heuristicJudge(submittedText, challenge);
      }
    } else {
      judge = heuristicJudge(submittedText, challenge);
    }

    if (!submissionIsCurrent(token, revisionId)) {
      finishSubmission(token);
      return;
    }
    if (scoringNotice) pushToast(scoringNotice, 'warn');

    const latestState = latestStateRef.current;

    if (revisionId) {
      const currentRevision = latestState.entries.find((entry) => entry.id === revisionId);
      if (!canReviseEntry(currentRevision)) {
        pushToast('This piece already has two completed revisions.', 'warn');
        finishSubmission(token);
        return;
      }
      const currentLedger = latestState.earnings.ledger.find((row) => row.id === currentRevision.earningsId);
      const reward = resolveRevisionReward({
        ledger: currentLedger,
        ledgerEntries: latestState.earnings.ledger,
        candidateTier: judge.tier,
        dailyCapDollars: latestState.settings.dailyCapDollars,
        nowMs: Date.now(),
      });
      const ledgerPatch = reward.patch ?? {
        amount: 0,
        tier: judge.tier,
        status: 'forfeited' as const,
      };

      dispatch({
        type: 'REVISE_ENTRY',
        entryId: currentRevision.id,
        text: submittedText,
        wordCount: submittedWordCount,
        judge,
        ledgerPatch,
      });
      revisionToast(reward);
      finishSubmission(token);
      dispatch({ type: 'NAV_RESET', screen: 'result' });
      return;
    }

    const now = Date.now();
    const reward = resolveFreshReward({
      ledgerEntries: latestState.earnings.ledger,
      candidateTier: judge.tier,
      dailyCapDollars: latestState.settings.dailyCapDollars,
      capBehavior: latestState.settings.capBehavior,
      nowMs: now,
    });
    if (!reward.accepted) {
      pushToast('You’ve reached today’s reward limit. New submissions open tomorrow.', 'warn');
      finishSubmission(token);
      return;
    }

    const entryId = makeId();
    const ledgerId = makeId();
    const entry: Entry = {
      id: entryId,
      date: isoFromTimestamp(now),
      createdAt: now,
      mode,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      prompt: challenge.prompt,
      text: submittedText,
      wordCount: submittedWordCount,
      revisionCount: 0,
      judge,
      earningsId: ledgerId,
    };
    const ledger: LedgerEntry = {
      id: ledgerId,
      entryId,
      amount: reward.amount,
      tier: judge.tier,
      status: reward.status,
      createdAt: now,
    };

    dispatch({ type: 'SUBMIT_ENTRY', entry, ledger });
    clearDraft();
    if (reward.status === 'forfeited' && judge.tier !== 'none') {
      pushToast('Daily cap reached — this one’s for practice.', 'warn');
    }
    finishSubmission(token);
    dispatch({ type: 'NAV_RESET', screen: 'result' });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-slide-up" aria-labelledby={headingId}>
      <header className="relative overflow-hidden rounded-[1.75rem] border border-line-2 bg-gradient-to-br from-surface via-surface to-gold/10 p-5 shadow-card sm:p-7">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-gold/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-teal/10 blur-3xl" />
        <div className="relative">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-micro font-semibold uppercase tracking-[0.12em] text-gold-deep">
              <ModeIcon size={14} aria-hidden="true" />
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-micro font-semibold uppercase tracking-[0.12em] text-teal">
              <Sparkles size={13} aria-hidden="true" />
              Craft focus: {challenge.skill}
            </span>
          </div>

          <div className={challenge.visual ? 'grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start' : ''}>
            <div>
              <p className="mb-1 font-serif text-caption italic text-text-muted">
                {revising ? 'Return to the page with one fresh idea.' : 'Take the idea somewhere only you can.'}
              </p>
              <h1 id={headingId} className="font-display text-h1 font-semibold leading-tight text-text">
                {challenge.title}
              </h1>
            </div>
            {challenge.visual && (
              <div
                className="w-fit rounded-2xl border border-line bg-paper/80 px-4 py-3 text-2xl tracking-[0.18em] shadow-sm sm:text-right"
                aria-label="Prompt scene"
              >
                {challenge.visual}
              </div>
            )}
          </div>

          {challenge.original && (
            <div className="mt-5 rounded-xl border border-rust/20 bg-rust/10 px-4 py-3">
              <div className="mb-1 text-micro font-semibold uppercase tracking-[0.12em] text-rust">
                Boring original — make it shine
              </div>
              <p className="font-serif text-body italic text-text">{challenge.original}</p>
            </div>
          )}

          <div className="mt-5 border-l-2 border-gold/50 pl-4">
            <p className="font-serif text-[1.05rem] leading-7 text-text-muted">{challenge.prompt}</p>
          </div>
        </div>
      </header>

      {revising && targetDimension && revisionAvailability && (
        <section
          className="rounded-2xl border p-4 shadow-sm sm:p-5"
          style={{
            backgroundColor: `color-mix(in srgb, ${DIMENSIONS[targetDimension].color} 9%, var(--surface))`,
            borderColor: `color-mix(in srgb, ${DIMENSIONS[targetDimension].color} 34%, transparent)`,
          }}
          aria-labelledby={`${fieldId}-revision-heading`}
        >
          <div className="flex items-start gap-3">
            {(() => {
              const Glyph = DIMENSIONS[targetDimension].Glyph;
              return (
                <span className="mt-0.5 rounded-lg bg-surface/80 p-2 shadow-sm">
                  <Glyph size={18} style={{ color: DIMENSIONS[targetDimension].color }} aria-hidden="true" />
                </span>
              );
            })()}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2
                  id={`${fieldId}-revision-heading`}
                  className="font-display text-h3 font-semibold text-text"
                >
                  Revision {(revising.revisionCount ?? 0) + 1} of {MAX_REVISIONS}
                </h2>
                <span className="text-micro font-semibold uppercase tracking-[0.12em]" style={{ color: DIMENSIONS[targetDimension].color }}>
                  Focus: {DIMENSIONS[targetDimension].kidLabel}
                </span>
              </div>

              {revisionLimitReached ? (
                <p className="text-caption leading-relaxed text-rust">
                  Two revisions are already complete. This piece cannot be resubmitted again.
                </p>
              ) : (
                <>
                  <p className="text-caption leading-relaxed text-text-muted">
                    Work on {DIMENSIONS[targetDimension].kidLabel}; each completed revision earns +8 XP.
                  </p>
                  {practiceMessage ? (
                    <p className="mt-2 rounded-lg border border-line bg-surface/70 px-3 py-2 text-caption leading-relaxed text-text">
                      {practiceMessage}
                    </p>
                  ) : (
                    <p className="mt-2 rounded-lg border border-line bg-surface/70 px-3 py-2 text-caption leading-relaxed text-text">
                      Keep your best reward. A stronger revision can earn more, within today’s remaining ${cap.remaining.toFixed(2)}.
                    </p>
                  )}
                </>
              )}

              {revising.judge.suggestions.length > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  <div className="mb-1.5 text-micro font-semibold uppercase tracking-[0.12em] text-text-faint">
                    Coach notes from the last read
                  </div>
                  <ul className="space-y-1.5 text-caption leading-relaxed text-text-muted">
                    {revising.judge.suggestions.map((suggestion, index) => (
                      <li key={`${suggestion}-${index}`} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {challenge.questions && challenge.questions.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-gold/20 bg-surface/80 shadow-sm">
          <button
            type="button"
            onClick={() => setShowGuides((visible) => !visible)}
            className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gold/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/60"
            aria-expanded={showGuides}
            aria-controls={guideId}
          >
            <span className="rounded-lg bg-gold/15 p-2 text-gold-deep">
              <Lightbulb size={17} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display text-h3 font-semibold text-text">Ideas to explore</span>
              <span className="block text-micro text-text-faint">Use any that spark something; you do not need all of them.</span>
            </span>
            <span className="ml-auto text-caption font-medium text-text-muted">{showGuides ? 'Hide' : 'Show'}</span>
          </button>
          {showGuides && (
            <ul id={guideId} className="grid gap-2 border-t border-line px-4 py-4 sm:grid-cols-2">
              {challenge.questions.map((question, index) => (
                <li key={question} className="flex gap-2.5 rounded-xl bg-gold/5 px-3 py-2.5 font-serif text-caption leading-relaxed text-text-muted">
                  <span className="font-sans text-micro font-semibold text-gold-deep" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-[1.75rem] border border-paper-edge bg-paper-texture shadow-paper" aria-labelledby={draftHeadingId}>
        <div className="border-b border-ink/10 bg-paper/90 px-5 py-4 sm:px-7">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-ink/5 p-2 text-ink-soft">
              <Feather size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id={draftHeadingId} className="font-display text-h2 font-semibold text-ink">
                {revising ? 'Shape your next draft' : 'Write your draft'}
              </h2>
              <p id={writingGuidanceId} className="mt-0.5 text-caption leading-relaxed text-ink-muted">
                Draft freely first. On a reread, look for one vivid detail, one precise verb, and an ending that feels complete.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
          <label id={draftLabelId} htmlFor={textareaId} className="mb-2 block text-micro font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Your writing
          </label>
          <Textarea
            id={textareaId}
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            readOnly={submitting}
            aria-busy={submitting}
            placeholder="Begin here…"
            rows={12}
            spellCheck
            className="min-h-[20rem]"
            aria-describedby={`${writingGuidanceId} ${wordGoalId}-status`}
          />

          <div className="mt-5 border-t border-ink/10 pt-4">
            <WordGoalTracker id={wordGoalId} count={wordCount} min={minTarget} max={maxTarget} />
            <div className="mt-3 flex items-center justify-between gap-3 text-micro text-ink-muted">
              <span>{revising ? 'This version saves when you resubmit.' : 'Your draft auto-saves on this device.'}</span>
              <span className="shrink-0 font-medium tabular-nums">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            </div>
          </div>
        </div>
      </section>

      {capLocks && (
        <div role="status" className="rounded-xl border border-rust/30 bg-rust/10 p-3 text-caption leading-relaxed text-text">
          You’ve earned today’s max (${cap.cap.toFixed(2)}). New submissions resume tomorrow; saved drafts stay here.
        </div>
      )}

      {!hasEnoughWords && !capLocks && (
        <p className="text-center text-caption text-text-muted" aria-live="polite">
          Give the coach {submissionFloor - wordCount} more {submissionFloor - wordCount === 1 ? 'word' : 'words'} to read before submitting.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => {
            if (revising) dispatch({ type: 'CANCEL_REVISION' });
            dispatch({ type: 'NAV_BACK' });
          }}
          className="sm:flex-1"
        >
          {revising ? 'Cancel revision' : 'Save & exit'}
        </Button>
        <Button
          type="button"
          variant="gold"
          size="md"
          onClick={submit}
          disabled={!canSubmit || capLocks}
          className="sm:flex-[2]"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          {submitting ? 'Reading…' : revising ? 'Read my revision' : 'Read my writing'}
        </Button>
      </div>
    </div>
  );
}

function WordGoalTracker({ id, count, min, max }: { id: string; count: number; min: number; max: number }) {
  const progress = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 100;
  const minimumMarker = max > 0 ? Math.min(100, Math.round((min / max) * 100)) : 0;

  let hint: string;
  if (count === 0) {
    hint = 'Start with one clear image, action, or sentence.';
  } else if (count < Math.ceil(min / 2)) {
    hint = 'You have a beginning. Follow the idea that feels most interesting.';
  } else if (count < min) {
    hint = `${min - count} ${min - count === 1 ? 'word' : 'words'} to the suggested range.`;
  } else if (count <= max) {
    hint = 'You’re in the suggested range. Keep shaping it, or stop when it feels complete.';
  } else {
    hint = 'You’ve moved beyond the suggested range. Keep what serves the piece.';
  }

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2 text-ink-soft">
          <Target size={16} aria-hidden="true" />
          <span id={`${id}-label`} className="text-caption font-semibold">Suggested word range</span>
        </div>
        <span className="font-mono text-caption font-semibold tabular-nums text-ink">
          {min}–{max}
        </span>
      </div>

      <div
        role="progressbar"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-status`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(count, max)}
        aria-valuetext={`${count} ${count === 1 ? 'word' : 'words'} written. ${hint}`}
        className="relative h-2.5 overflow-hidden rounded-full bg-ink/10"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-teal via-gold-bright to-gold transition-[width] duration-300" style={{ width: `${progress}%` }} />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-ink/40"
          style={{ left: `${minimumMarker}%` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[0.65rem] text-ink-muted">
        <span>Start</span>
        <span>Minimum {min}</span>
        <span>Stretch {max}</span>
      </div>
      <p id={`${id}-status`} className="mt-2 flex items-start gap-2 text-caption leading-relaxed text-ink-muted" aria-live="polite" aria-atomic="true">
        <BookOpen size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="sr-only">{count} {count === 1 ? 'word' : 'words'} written. </span>
          {hint} <span className="whitespace-nowrap">These are guideposts, not a limit.</span>
        </span>
      </p>
    </div>
  );
}
