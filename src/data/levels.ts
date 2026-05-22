import type { Level } from '../types';

export const LEVELS: Level[] = [
  { id: 'apprentice', name: 'Apprentice', icon: 'Feather',  min: 0,    max: 150  },
  { id: 'voice',      name: 'Voice',      icon: 'Quote',    min: 150,  max: 400  },
  { id: 'stylist',    name: 'Stylist',    icon: 'Wand',     min: 400,  max: 800  },
  { id: 'storyteller',name: 'Storyteller',icon: 'BookOpen', min: 800,  max: 1500 },
  { id: 'author',     name: 'Author',     icon: 'PenTool',  min: 1500, max: Number.POSITIVE_INFINITY },
];

export function getLevel(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

export function levelProgress(xp: number): { pct: number; level: Level } {
  const level = getLevel(xp);
  if (!isFinite(level.max)) return { pct: 100, level };
  const pct = Math.min(100, Math.max(0, Math.round(((xp - level.min) / (level.max - level.min)) * 100)));
  return { pct, level };
}
