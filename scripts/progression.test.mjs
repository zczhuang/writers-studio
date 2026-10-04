import assert from 'node:assert/strict';
import test from 'node:test';

import { BADGES } from '../src/data/badges.ts';
import { dimensionsForChallenge } from '../src/data/promptSkills.ts';
import { MODE_ORDER, badgeProgress, dailyMissions, entriesOnDate, modeProgress, rankSnapshot, recommendedChallenge, weeklyActivity, xpForEntry } from '../src/utils/progression.ts';
import { POOLS } from '../src/data/prompts.ts';

const DIMS = ['vocabulary', 'imagery', 'voice', 'structure', 'originality'];

function localStamp(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

function makeJudge(tier = 'silver', score = 80) {
  return {
    score,
    tier,
    breakdown: { vocabulary: 6, imagery: 6, voice: 6, structure: 6, originality: 7 },
    strengths: [],
    suggestions: [],
    celebrate: '',
    source: 'heuristic',
  };
}

function makeEntry(overrides = {}) {
  return {
    id: 'entry-1',
    date: '2026-10-03',
    createdAt: localStamp('2026-10-03'),
    mode: 'scene',
    challengeId: 'sc1',
    challengeTitle: 'A page',
    prompt: 'Write a page.',
    text: 'A small piece of writing.',
    wordCount: 10,
    judge: makeJudge(),
    earningsId: 'ledger-1',
    ...overrides,
  };
}

function emptyBadgeState() {
  return {
    writer: {
      name: 'Writer',
      xp: 0,
      streak: 0,
      bestStreak: 0,
      graceTokens: 0,
      lastPlayDate: null,
      totalWords: 0,
      totalChallenges: 0,
      maxScore: 0,
      modesPlayed: [],
      achievements: [],
      activeQuests: [],
    },
    entries: [],
    earnings: { ledger: [], lifetimePaid: 0, lifetimePending: 0 },
  };
}

test('rank snapshots stay finite at every boundary, including final Author', () => {
  const expected = [
    [0, 'Apprentice', 0],
    [149, 'Apprentice', 99],
    [150, 'Voice', 0],
    [400, 'Stylist', 0],
    [800, 'Storyteller', 0],
    [1500, 'Author', 100],
    [999999, 'Author', 100],
  ];

  for (const [xp, name, pct] of expected) {
    const snapshot = rankSnapshot(xp);
    assert.equal(snapshot.level.name, name);
    assert.equal(snapshot.pct, pct);
    assert.equal(Number.isFinite(snapshot.pct), true);
    assert.equal(snapshot.pct >= 0 && snapshot.pct <= 100, true);
  }
});

test('fresh and revised XP use the exact reducer-compatible formula', () => {
  const judge = makeJudge('gold', 80);
  assert.equal(xpForEntry({ judge, revisionCount: 0 }), 86);
  assert.equal(xpForEntry({ judge, revisionCount: undefined }), 86);
  assert.equal(xpForEntry({ judge, revisionCount: 1 }), 8);
  assert.equal(xpForEntry({ judge, revisionCount: 2 }), 8);
});

test('explicit saved dates win over conflicting timestamps and invalid dates fall back', () => {
  const explicit = makeEntry({ id: 'explicit', date: '2026-10-03', createdAt: localStamp('2026-10-02'), wordCount: 25 });
  const fallback = makeEntry({ id: 'fallback', date: 'not-a-date', createdAt: localStamp('2026-10-02'), wordCount: 10 });
  const missing = makeEntry({ id: 'missing', date: '', createdAt: localStamp('2026-10-02'), wordCount: 5 });
  const entries = [explicit, fallback, missing];

  assert.deepEqual(entriesOnDate(entries, '2026-10-03').map((entry) => entry.id), ['explicit']);
  assert.deepEqual(entriesOnDate(entries, '2026-10-02').map((entry) => entry.id), ['fallback', 'missing']);

  const missions = dailyMissions(entries, '2026-10-03');
  assert.equal(missions[0].progress, 1);
  assert.equal(missions[1].progress, 25);
  assert.equal(missions[2].progress, 1);
  assert.equal(missions[1].complete, false);
  const completeMissions = dailyMissions([...entries, makeEntry({ id: 'second-today', date: '2026-10-03', createdAt: localStamp('2026-10-03'), mode: 'story', wordCount: 75 })], '2026-10-03');
  assert.equal(completeMissions[0].complete, true);
  assert.equal(completeMissions[1].complete, true);
  assert.equal(completeMissions[2].complete, true);
  assert.equal(dailyMissions(entries, '2026-10-04').every((mission) => mission.progress === 0), true);

  const week = weeklyActivity(entries, '2026-10-03');
  assert.equal(week.length, 7);
  assert.equal(week.at(-1).date, '2026-10-03');
  assert.equal(week.at(-1).entries, 1);
  assert.equal(week.at(-1).words, 25);
  assert.equal(week.at(-2).entries, 2);
  assert.equal(week.at(-2).words, 15);
});

test('daily missions honor word and distinct-mode boundaries, then reset the next day', () => {
  const date = '2026-10-03';
  const first = makeEntry({ id: 'first', date, createdAt: localStamp(date), mode: 'scene', wordCount: 99 });
  const sameMode = makeEntry({ id: 'same-mode', date, createdAt: localStamp(date), mode: 'scene', wordCount: 1 });
  const differentMode = makeEntry({ id: 'different-mode', date, createdAt: localStamp(date), mode: 'story', wordCount: 1 });

  const ninetyNine = dailyMissions([first], date);
  assert.equal(ninetyNine[1].progress, 99);
  assert.equal(ninetyNine[1].complete, false);

  const sameModeMissions = dailyMissions([first, sameMode], date);
  assert.equal(sameModeMissions[0].complete, true);
  assert.equal(sameModeMissions[1].progress, 100);
  assert.equal(sameModeMissions[1].complete, true);
  assert.equal(sameModeMissions[2].progress, 1);
  assert.equal(sameModeMissions[2].complete, false);

  const differentModeMissions = dailyMissions([first, differentMode], date);
  assert.equal(differentModeMissions[2].progress, 2);
  assert.equal(differentModeMissions[2].complete, true);

  const nextDay = dailyMissions([first, sameMode, differentMode], '2026-10-04');
  assert.deepEqual(nextDay.map((mission) => mission.progress), [0, 0, 0]);
  assert.equal(nextDay.every((mission) => mission.complete === false), true);
});

test('weekly activity keeps seven local calendar dates across a DST boundary', () => {
  const week = weeklyActivity([], '2026-11-04');
  assert.deepEqual(week.map((day) => day.date), [
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
  ]);
});

test('mode completion counts only unique in-pool challenges', () => {
  const entries = [
    makeEntry({ id: 'one', challengeId: 'sc1', mode: 'scene' }),
    makeEntry({ id: 'repeat', challengeId: 'sc1', mode: 'scene' }),
    makeEntry({ id: 'foreign', challengeId: 'not-a-scene-prompt', mode: 'scene' }),
    makeEntry({ id: 'story', challengeId: POOLS.story[0].id, mode: 'story' }),
  ];
  const scene = modeProgress(entries, 'scene');
  const story = modeProgress(entries, 'story');
  assert.equal(scene.completed, 1);
  assert.equal(scene.total, POOLS.scene.length);
  assert.equal(scene.pct, Math.round((1 / POOLS.scene.length) * 100));
  assert.equal(story.completed, 1);
});

test('recommendations prefer unplayed prompts and replay growth edges honestly', () => {
  const first = recommendedChallenge([], { growthEdge: 'imagery' });
  assert.equal(first.isReplay, false);
  assert.equal(dimensionsForChallenge(first.challenge).includes('imagery'), true);

  const allEntries = MODE_ORDER.flatMap((mode) => POOLS[mode].map((challenge, index) => makeEntry({
    id: `${mode}-${index}`,
    mode,
    challengeId: challenge.id,
  })));
  const used = new Set(allEntries.map((entry) => entry.challengeId));

  for (const growthEdge of DIMS) {
    const replay = recommendedChallenge(allEntries, { growthEdge });
    assert.equal(replay.isReplay, true);
    assert.equal(used.has(replay.challenge.id), true);
    assert.equal(dimensionsForChallenge(replay.challenge).includes(growthEdge), true);
    assert.equal(replay.growthDimension, growthEdge);
  }

  const noMatch = recommendedChallenge(allEntries, { growthEdge: 'not-a-real-dimension' });
  assert.equal(noMatch.isReplay, true);
  assert.equal(noMatch.growthDimension, null);
});

test('badge progress reaches exactly the same thresholds as BADGES.check', () => {
  const empty = emptyBadgeState();
  for (const def of BADGES) {
    assert.equal(def.check(empty), false, `${def.id} should start locked`);
    assert.equal(badgeProgress(def.id, empty, def).current, 0, `${def.id} should start at zero`);
  }

  const earned = emptyBadgeState();
  earned.writer.streak = 14;
  earned.writer.totalWords = 5000;
  earned.writer.totalChallenges = 1;
  earned.writer.modesPlayed = ['scene', 'story', 'mystery', 'upgrade'];
  earned.entries = [
    makeEntry({ id: 'silver', judge: makeJudge('silver') }),
    makeEntry({ id: 'gold', judge: makeJudge('gold') }),
    makeEntry({ id: 'platinum', judge: makeJudge('platinum') }),
  ];
  earned.earnings = { ledger: [], lifetimePaid: 1, lifetimePending: 9 };

  for (const def of BADGES) {
    const progress = badgeProgress(def.id, earned, def);
    assert.equal(def.check(earned), true, `${def.id} should be earned at its threshold`);
    assert.equal(progress.current, progress.target, `${def.id} progress should be complete`);
  }
});
