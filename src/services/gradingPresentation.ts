import type { JudgeResult } from '../types';
import { tierLabel } from './scoring';

export interface GradingPresentation {
  available: boolean;
  tierText: string;
  scoreText: string;
}

/** Keeps damaged/recovered placeholder grades from looking like genuine 0/100 results. */
export function gradingPresentation(value: { judge: JudgeResult; gradingComplete?: boolean }): GradingPresentation {
  if (value.gradingComplete === false) {
    return { available: false, tierText: 'Grade unavailable', scoreText: '' };
  }
  return {
    available: true,
    tierText: tierLabel(value.judge.tier),
    scoreText: `${value.judge.score}/100`,
  };
}
