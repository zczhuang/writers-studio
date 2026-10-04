import type { AppState } from '../types';
import type { Action } from './actions';
import { makeInitialState } from './initialState';
import { buildMemory, foldEntry } from '../services/writerMemory';
import { getSkillCard } from '../data/skillCards';
import { canReviseEntry, resolveRevisionReward } from '../services/revision';
import { resolveFreshReward } from '../services/dailyCap';
import { isoFromTimestamp } from '../utils/date';
import { appendProgressOperation, touchProgress } from './progress';
import { ensureEntryVersions, makeFirstDraftVersion, makeRevisionVersion } from './normalization';
import { stableId } from '../utils/stable';

const RECENT_SKILLS_CAP = 3;

function versionIdExists(state: AppState, versionId: string): boolean {
  return state.entries.some((entry) => ensureEntryVersions(entry).some((version) => version.id === versionId));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE': {
      return { ...state, ...action.payload };
    }

    case 'APPLY_SYNC_STATE': {
      const incoming = action.payload;
      return {
        ...incoming,
        // A cloud/import merge is data hydration, not navigation or authentication.
        screen: state.screen,
        navStack: state.navStack,
        currentMode: state.currentMode,
        currentChallengeId: state.currentChallengeId,
        lastJudge: state.lastJudge,
        lastEntryId: state.lastEntryId,
        revisingEntryId: state.revisingEntryId,
        parentUnlockedUntil: state.parentUnlockedUntil,
        parentGateTarget: state.parentGateTarget,
        settings: {
          ...incoming.settings,
          parentPinHash: state.settings.parentPinHash,
          parentPinSalt: state.settings.parentPinSalt,
          geminiApiKey: state.settings.geminiApiKey,
        },
      };
    }

    case 'NAV': {
      if (action.screen === state.screen) return state;
      return {
        ...state,
        screen: action.screen,
        navStack: [...state.navStack, state.screen],
      };
    }

    case 'NAV_RESET': {
      return { ...state, screen: action.screen, navStack: [] };
    }

    case 'NAV_BACK': {
      const stack = [...state.navStack];
      const prev = stack.pop();
      if (!prev) return { ...state, screen: 'home', navStack: [] };
      return { ...state, screen: prev, navStack: stack };
    }

    case 'PICK_MODE': {
      return { ...state, currentMode: action.mode, currentChallengeId: null };
    }

    case 'PICK_CHALLENGE': {
      return { ...state, currentChallengeId: action.challengeId };
    }

    case 'SUBMIT_ENTRY': {
      const entryId = typeof action.entry.id === 'string' ? action.entry.id.trim() : '';
      const ledgerId = typeof action.ledger.id === 'string' ? action.ledger.id.trim() : '';
      const firstVersionId = `draft-${entryId}`;
      const operationId = `submit:${entryId}`;
      if (
        !entryId
        || !ledgerId
        || state.entries.some((entry) => entry.id === entryId || entry.earningsId === ledgerId)
        || state.earnings.ledger.some((row) => row.id === ledgerId || row.entryId === entryId)
        || versionIdExists(state, firstVersionId)
        || state.progress.operations.some((operation) =>
          operation.id === operationId || operation.entryId === entryId || operation.versionId === firstVersionId
        )
      ) return state;

      const submittedAt = Date.now();
      const reward = resolveFreshReward({
        ledgerEntries: state.earnings.ledger,
        candidateTier: action.entry.judge.tier,
        dailyCapDollars: state.settings.dailyCapDollars,
        capBehavior: state.settings.capBehavior,
        nowMs: submittedAt,
      });
      if (!reward.accepted) return state;

      const entry = {
        ...action.entry,
        id: entryId,
        earningsId: ledgerId,
        date: isoFromTimestamp(submittedAt),
        createdAt: submittedAt,
      };
      const ledger = {
        id: ledgerId,
        entryId: entry.id,
        amount: reward.amount,
        tier: entry.judge.tier,
        status: reward.status,
        createdAt: submittedAt,
      };
      const w = state.writer;
      const today = entry.date;
      const yesterday = (() => {
        const d = new Date(today + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      })();

      let streak = w.streak;
      let graceTokens = w.graceTokens;
      if (w.lastPlayDate !== today) {
        if (w.lastPlayDate === yesterday) streak += 1;
        else if (w.lastPlayDate === null) streak = 1;
        else {
          // gap > 1 day
          const gapDays = (() => {
            if (!w.lastPlayDate) return 0;
            const last = new Date(w.lastPlayDate + 'T00:00:00');
            const now = new Date(today + 'T00:00:00');
            return Math.round((now.getTime() - last.getTime()) / 86_400_000);
          })();
          if (gapDays === 2 && graceTokens > 0) {
            graceTokens -= 1;
            streak += 1;
          } else {
            streak = 1;
          }
        }
      }
      const bestStreak = Math.max(w.bestStreak, streak);
      // Grace token earn at 7-day streak (cap 2)
      if (streak > 0 && streak % 7 === 0 && graceTokens < 2 && w.streak !== streak) graceTokens += 1;

      const modesPlayed = w.modesPlayed.includes(entry.mode) ? w.modesPlayed : [...w.modesPlayed, entry.mode];

      const xpGain = 20 + Math.round(entry.judge.score * 0.5) + entry.judge.breakdown.imagery * 2 + entry.judge.breakdown.originality * 2;

      const newWriter = {
        ...w,
        xp: w.xp + xpGain,
        streak,
        bestStreak,
        graceTokens,
        lastPlayDate: today,
        totalWords: w.totalWords + entry.wordCount,
        totalChallenges: w.totalChallenges + 1,
        maxScore: Math.max(w.maxScore, entry.judge.score),
        modesPlayed,
      };

      const firstVersion = makeFirstDraftVersion(entry, xpGain);
      const storedEntry = {
        ...entry,
        revisionCount: 0,
        gradingComplete: true,
        versions: [firstVersion],
        currentVersionId: firstVersion.id,
        firstDraft: {
          versionId: firstVersion.id,
          createdAt: entry.createdAt,
          wordCount: entry.wordCount,
          xpAwarded: xpGain,
        },
      };
      const entries = [...state.entries, storedEntry];

      const ledgerList = [...state.earnings.ledger, ledger];
      const lifetimePaid = ledgerList.filter((l) => l.status === 'paid').reduce((s, l) => s + l.amount, 0);
      const lifetimePending = ledgerList.filter((l) => l.status === 'pending').reduce((s, l) => s + l.amount, 0);

      return {
        ...state,
        writer: newWriter,
        entries,
        memory: foldEntry(state.memory, storedEntry),
        earnings: { ledger: ledgerList, lifetimePaid, lifetimePending },
        progress: appendProgressOperation(state.progress, {
          id: operationId,
          kind: 'entry-submit',
          entryId: storedEntry.id,
          versionId: firstVersion.id,
          createdAt: submittedAt,
          xpDelta: xpGain,
          totalWordsDelta: storedEntry.wordCount,
          totalChallengesDelta: 1,
        }),
        lastJudge: storedEntry.judge,
        lastEntryId: storedEntry.id,
      };
    }

    case 'START_REVISION': {
      const entry = state.entries.find((e) => e.id === action.entryId);
      if (!canReviseEntry(entry)) return state;
      return {
        ...state,
        revisingEntryId: action.entryId,
        currentMode: entry.mode,
        currentChallengeId: entry.challengeId,
        screen: 'write',
        navStack: [...state.navStack, state.screen],
      };
    }

    case 'CANCEL_REVISION': {
      return { ...state, revisingEntryId: null };
    }

    case 'REVISE_ENTRY': {
      const { entryId, text, wordCount, judge } = action;
      if (typeof entryId !== 'string' || !entryId.trim()) return state;
      const originalEntry = state.entries.find((e) => e.id === entryId);
      if (!canReviseEntry(originalEntry)) return state;

      const priorVersions = ensureEntryVersions(originalEntry);
      if (action.revisionVersionId !== undefined && (typeof action.revisionVersionId !== 'string' || !action.revisionVersionId.trim())) return state;
      const revisionVersionId = action.revisionVersionId ?? `revision-${entryId}-${stableId({
        text,
        wordCount,
        judge,
      })}`;
      const operationId = `revision:${entryId}:${revisionVersionId}`;
      if (
        versionIdExists(state, revisionVersionId)
        || state.progress.operations.some((operation) => operation.id === operationId || operation.versionId === revisionVersionId)
      ) return state;

      const now = Date.now();
      const revisedAt = action.occurredAt ?? now;
      const revisionVersion = makeRevisionVersion(originalEntry, revisionVersionId, revisedAt, text, wordCount, judge);

      const originalLedger = state.earnings.ledger.find((l) => l.id === originalEntry.earningsId);
      const reward = resolveRevisionReward({
        ledger: originalLedger,
        ledgerEntries: state.earnings.ledger,
        candidateTier: judge.tier,
        dailyCapDollars: state.settings.dailyCapDollars,
        nowMs: now,
      });

      const entries = state.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              text,
              wordCount,
              judge,
              gradingComplete: true,
              revisionCount: (e.revisionCount ?? 0) + 1,
              versions: [...priorVersions, revisionVersion],
              currentVersionId: revisionVersion.id,
            }
          : e
      );

      let earnings = state.earnings;
      if (reward.rewardChanged && reward.patch && originalLedger) {
        const ledger = state.earnings.ledger.map((row) =>
          row.id === originalLedger.id ? { ...row, ...reward.patch } : row
        );
        earnings = {
          ledger,
          lifetimePaid: ledger.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0),
          lifetimePending: ledger.filter((row) => row.status === 'pending').reduce((sum, row) => sum + row.amount, 0),
        };
      }

      // Recompute memory from the corrected history (the revised piece now carries its
      // better scores) while preserving the skill-recommendation rotation state.
      const rebuilt = buildMemory(entries);
      const memory = {
        ...rebuilt,
        recentlyShownSkills: state.memory.recentlyShownSkills,
        lastSkillSource: state.memory.lastSkillSource,
      };

      const writer = {
        ...state.writer,
        maxScore: Math.max(state.writer.maxScore, judge.score),
        xp: state.writer.xp + 8, // small bonus for the revision effort
      };

      return {
        ...state,
        entries,
        earnings,
        memory,
        writer,
        progress: appendProgressOperation(state.progress, {
          id: operationId,
          kind: 'entry-revision',
          entryId,
          versionId: revisionVersion.id,
          createdAt: revisedAt,
          xpDelta: 8,
          totalWordsDelta: 0,
          totalChallengesDelta: 0,
        }),
        lastJudge: judge,
        lastEntryId: entryId,
        revisingEntryId: null,
      };
    }

    case 'CLEAR_LAST_JUDGE': {
      return { ...state, lastJudge: null, lastEntryId: null };
    }

    case 'SET_SETTINGS': {
      return { ...state, settings: { ...state.settings, ...action.settings }, progress: touchProgress(state.progress) };
    }

    case 'UNLOCK_PARENT': {
      return { ...state, parentUnlockedUntil: action.untilMs };
    }

    case 'LOCK_PARENT': {
      return { ...state, parentUnlockedUntil: 0 };
    }

    case 'REQUEST_PARENT_GATE': {
      return {
        ...state,
        screen: 'parent-gate',
        navStack: [...state.navStack, state.screen],
        parentGateTarget: action.target,
      };
    }

    case 'PAY_LEDGER': {
      const now = Date.now();
      const idSet = new Set(action.ids);
      const ledger = state.earnings.ledger.map((l) =>
        idSet.has(l.id) && l.status === 'pending'
          ? { ...l, status: 'paid' as const, paidAt: now, paidNote: action.note }
          : l
      );
      const lifetimePaid = ledger.filter((l) => l.status === 'paid').reduce((s, l) => s + l.amount, 0);
      const lifetimePending = ledger.filter((l) => l.status === 'pending').reduce((s, l) => s + l.amount, 0);
      return { ...state, earnings: { ledger, lifetimePaid, lifetimePending }, progress: touchProgress(state.progress, now) };
    }

    case 'UPDATE_WRITER': {
      return { ...state, writer: { ...state.writer, ...action.patch }, progress: touchProgress(state.progress) };
    }

    case 'UNLOCK_ACHIEVEMENTS': {
      const now = Date.now();
      const have = new Set(state.writer.achievements.map((a) => a.id));
      const newOnes = action.ids.filter((id) => !have.has(id)).map((id) => ({ id, unlockedAt: now }));
      if (!newOnes.length) return state;
      return {
        ...state,
        writer: { ...state.writer, achievements: [...state.writer.achievements, ...newOnes] },
        progress: touchProgress(state.progress, now),
      };
    }

    case 'MARK_SKILL_PRACTICED': {
      const practiced = state.craft.practicedSkills.includes(action.id)
        ? state.craft.practicedSkills
        : [...state.craft.practicedSkills, action.id];
      // Rotate the "recently shown" ring + remember the source so the next
      // recommendation moves on and alternates classic/contemporary.
      const card = getSkillCard(action.id);
      const recent = [action.id, ...state.memory.recentlyShownSkills.filter((x) => x !== action.id)].slice(
        0,
        RECENT_SKILLS_CAP
      );
      return {
        ...state,
        craft: { ...state.craft, practicedSkills: practiced },
        memory: { ...state.memory, recentlyShownSkills: recent, lastSkillSource: card?.source ?? state.memory.lastSkillSource },
        progress: touchProgress(state.progress),
      };
    }

    case 'MARK_SKILL_MASTERED': {
      const mastered = state.craft.masteredSkills.includes(action.id)
        ? state.craft.masteredSkills
        : [...state.craft.masteredSkills, action.id];
      const practiced = state.craft.practicedSkills.includes(action.id)
        ? state.craft.practicedSkills
        : [...state.craft.practicedSkills, action.id];
      return { ...state, craft: { practicedSkills: practiced, masteredSkills: mastered }, progress: touchProgress(state.progress) };
    }

    case 'RESET_ALL': {
      return makeInitialState();
    }

    default:
      return state;
  }
}
