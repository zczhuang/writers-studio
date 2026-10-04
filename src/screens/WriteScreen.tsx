import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Feather, HardDrive, Lightbulb, Loader2, Send, Sparkles, Target } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { getChallenge, MODE_META } from '../data/prompts';
import { MODE_THEME } from '../data/modeTheme';
import { toneVars } from '../data/tones';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { StarField } from '../components/art/StarField';
import { ProgressRing } from '../components/art/ProgressRing';
import { useDraft } from '../hooks/useDraft';
import { countWords } from '../utils/text';
import { heuristicJudge } from '../services/heuristic';
import { judgeWriting, GeminiError, inCooldown } from '../services/gemini';
import { coachContext } from '../services/writerMemory';
import { id as makeId } from '../utils/id';
import { useDailyCap } from '../hooks/useDailyCap';
import type { Entry, JudgeBreakdown, JudgeResult, LedgerEntry } from '../types';
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
  const theme = MODE_THEME[mode];
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

  const sceneClues = challenge.visual ? challenge.visual.split(/\s+/).filter(Boolean) : [];

  return (
    <div className="ws-write" style={toneVars(mode)} aria-labelledby={headingId}>
      <header className="ws-prompt-card ws-rise">
        <StarField seed={challenge.id.length * 13 + 7} count={26} sparkles={2} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="ws-chip"><theme.Icon size={14} aria-hidden="true" /> {meta.label}</span>
          <span className="ws-chip"><Sparkles size={13} aria-hidden="true" /> Craft focus: {challenge.skill}</span>
        </div>
        <h1 id={headingId} className="ws-prompt-card-title">{challenge.title}</h1>
        <p className="ws-prompt-card-lede">
          {revising ? 'Return to the page with one fresh idea.' : 'Take the idea somewhere only you can.'}
        </p>
        {sceneClues.length > 0 && (
          <div className="ws-scene-strip" role="img" aria-label={`Scene clues: ${challenge.visual}`}>
            {sceneClues.map((clue, index) => <span key={`${clue}-${index}`} aria-hidden="true">{clue}</span>)}
          </div>
        )}
        {challenge.original && (
          <div className="ws-original">
            <div className="ws-original-label">Boring original: make it shine</div>
            <p>{challenge.original}</p>
          </div>
        )}
        <p className="ws-prompt-card-text">{challenge.prompt}</p>
      </header>

      {revising && targetDimension && revisionAvailability && (
        <section className="ws-revision" style={toneVars(targetDimension)} aria-labelledby={`${fieldId}-revision-heading`}>
          {(() => {
            const Glyph = DIMENSIONS[targetDimension].Glyph;
            return <span className="ws-medallion ws-medallion--solid" aria-hidden="true"><Glyph size={20} /></span>;
          })()}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id={`${fieldId}-revision-heading`} className="ws-h3">
                Revision {(revising.revisionCount ?? 0) + 1} of {MAX_REVISIONS}
              </h2>
              <span className="ws-chip">Focus: {DIMENSIONS[targetDimension].kidLabel}</span>
            </div>

            {revisionLimitReached ? (
              <p className="mt-2 text-[0.92rem] leading-relaxed text-rust">
                Two revisions are already complete. This piece cannot be resubmitted again.
              </p>
            ) : (
              <>
                <p className="ws-small mt-2">
                  Work on {DIMENSIONS[targetDimension].kidLabel}; each completed revision earns +8 XP.
                </p>
                <p className="ws-revision-note">
                  {practiceMessage ?? `Keep your best reward. A stronger revision can earn more, within today’s remaining $${cap.remaining.toFixed(2)}.`}
                </p>
              </>
            )}

            {revising.judge.suggestions.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="ws-kicker">Coach notes from the last read</div>
                <ul className="ws-coach-notes">
                  {revising.judge.suggestions.map((suggestion, index) => (
                    <li key={`${suggestion}-${index}`}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {challenge.questions && challenge.questions.length > 0 && (
        <section className="ws-card ws-ideas">
          <button
            type="button"
            onClick={() => setShowGuides((visible) => !visible)}
            className="ws-ideas-toggle"
            aria-expanded={showGuides}
            aria-controls={guideId}
          >
            <span className="ws-medallion ws-medallion--sm" style={toneVars('gold')} aria-hidden="true"><Lightbulb size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[1.1rem] font-semibold text-ink">Ideas to explore</span>
              <span className="block text-[0.84rem] text-text-muted">Use any that spark something; you don&apos;t need all of them.</span>
            </span>
            <ChevronDown size={18} className={`shrink-0 text-text-muted transition-transform ${showGuides ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {showGuides && (
            <ul id={guideId} className="ws-ideas-list">
              {challenge.questions.map((question, index) => (
                <li key={question}>
                  <b aria-hidden="true">{String(index + 1).padStart(2, '0')}</b>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="ws-manuscript" aria-labelledby={draftHeadingId}>
        <div className="ws-manuscript-head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="ws-medallion ws-medallion--sm" style={toneVars('night')} aria-hidden="true"><Feather size={17} /></span>
            <div className="min-w-0">
              <h2 id={draftHeadingId}>{revising ? 'Shape your next draft' : 'Write your draft'}</h2>
              <p id={writingGuidanceId}>
                Draft freely first. On a reread, look for one vivid detail, one precise verb, and an ending that feels complete.
              </p>
            </div>
          </div>
        </div>

        <div className="ws-manuscript-body">
          <label id={draftLabelId} htmlFor={textareaId} className="sr-only">Your writing</label>
          <Textarea
            id={textareaId}
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            readOnly={submitting}
            aria-busy={submitting}
            placeholder="Begin here…"
            rows={11}
            spellCheck
            aria-describedby={`${writingGuidanceId} ${wordGoalId}-status`}
          />
        </div>

        <div className="ws-manuscript-foot">
          <WordGoalTracker id={wordGoalId} count={wordCount} min={minTarget} max={maxTarget} />
          <div className="ws-autosave">
            <span><HardDrive size={13} aria-hidden="true" /> {revising ? 'This version saves when you resubmit.' : 'Your draft auto-saves on this device.'}</span>
            <span className="tabular font-semibold">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          </div>
        </div>
      </section>

      {capLocks && (
        <div role="status" className="ws-callout ws-callout--warn">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>You’ve earned today’s max (${cap.cap.toFixed(2)}). New submissions resume tomorrow; saved drafts stay here.</span>
        </div>
      )}

      {!hasEnoughWords && !capLocks && (
        <p className="text-center text-[0.92rem] text-text-muted" aria-live="polite">
          Give the coach {submissionFloor - wordCount} more {submissionFloor - wordCount === 1 ? 'word' : 'words'} to read before submitting.
        </p>
      )}

      <div className="ws-write-actions">
        <Button
          variant="ghost"
          onClick={() => {
            if (revising) dispatch({ type: 'CANCEL_REVISION' });
            dispatch({ type: 'NAV_BACK' });
          }}
        >
          {revising ? 'Cancel revision' : 'Save & exit'}
        </Button>
        <Button variant="gold" onClick={submit} disabled={!canSubmit || capLocks}>
          {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
          {submitting ? 'Reading…' : revising ? 'Read my revision' : 'Read my writing'}
        </Button>
      </div>
    </div>
  );
}

function WordGoalTracker({ id, count, min, max }: { id: string; count: number; min: number; max: number }) {
  const progress = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 100;
  const minimumMarker = max > 0 ? Math.min(100, Math.round((min / max) * 100)) : 0;
  const inRange = count >= min;

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
    <div className="ws-goal-row">
      <div className="ws-goal-copy">
        <div className="ws-goal-title">
          <span id={`${id}-label`} className="inline-flex items-center gap-2 text-ink"><Target size={16} aria-hidden="true" /> Suggested word range</span>
          <span>{min}–{max}</span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-status`}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={Math.min(count, max)}
          aria-valuetext={`${count} ${count === 1 ? 'word' : 'words'} written. ${hint}`}
          className="ws-goal-track"
        >
          <span style={{ width: `${progress}%` }} />
          <i aria-hidden="true" style={{ left: `${minimumMarker}%` }} />
        </div>
        <div className="ws-goal-scale">
          <span>Start</span>
          <span>Minimum {min}</span>
          <span>Stretch {max}</span>
        </div>
        <p id={`${id}-status`} className="ws-goal-hint" aria-live="polite" aria-atomic="true">
          <Sparkles size={14} aria-hidden="true" />
          <span>
            <span className="sr-only">{count} {count === 1 ? 'word' : 'words'} written. </span>
            {hint} <span className="whitespace-nowrap">These are guideposts, not a limit.</span>
          </span>
        </p>
      </div>
      <div className="ws-goal-count" aria-hidden="true" style={toneVars(inRange ? 'success' : 'gold')}>
        <ProgressRing pct={progress} size={67} stroke={6} />
        <span><strong>{count}</strong><small>words</small></span>
      </div>
    </div>
  );
}
