import type { QuestDef } from '../types';

export const QUESTS: QuestDef[] = [
  {
    id: 'senses',
    title: 'The Senses Quest',
    description:
      'Five pieces, each highlighting a different sense. Layer like a master describer.',
    bonusDollars: 0.25,
    steps: [
      { title: 'Sight', description: 'A Scene piece — focus on what your eyes alone can see.', mode: 'scene' },
      { title: 'Sound', description: 'A Story piece — make the reader hear it.', mode: 'story' },
      { title: 'Smell', description: 'A Mystery piece — describe through smell.', mode: 'mystery' },
      { title: 'Touch', description: 'A Scene piece — texture, temperature, pressure.', mode: 'scene' },
      { title: 'Taste', description: 'Any mode — make us taste something specific.' },
    ],
  },
  {
    id: 'voice',
    title: 'Voice Switch',
    description: 'Same kind of moment, three different tones. Find your range.',
    bonusDollars: 0.5,
    steps: [
      { title: 'Suspense', description: 'A Story piece written with slow, tense pacing.', mode: 'story' },
      { title: 'Humor', description: 'A Story piece — light, fast, funny.', mode: 'story' },
      { title: 'Wonder', description: 'A Scene piece — make the reader feel awe.', mode: 'scene' },
    ],
  },
  {
    id: 'precision',
    title: 'Precision Streak',
    description: 'Three Mystery pieces in a row — without naming the thing.',
    bonusDollars: 0.25,
    steps: [
      { title: 'First mystery', description: 'Aim for silver+.', mode: 'mystery', minTier: 'silver' },
      { title: 'Second mystery', description: 'Aim for silver+.', mode: 'mystery', minTier: 'silver' },
      { title: 'Third mystery', description: 'Aim for silver+.', mode: 'mystery', minTier: 'silver' },
    ],
  },
];
