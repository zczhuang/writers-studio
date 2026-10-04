import { BookOpen, Eye, Pen, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Mode } from '../types';
import { MODE_ORDER } from '../utils/progression';

/** Visual identity for each writing world, shared by every screen. */
export interface ModeTheme {
  Icon: LucideIcon;
  /** World name shown in illustrated contexts. */
  world: string;
  /** Short invitation, e.g. "A place to notice". */
  invitation: string;
  /** Two-digit world number, e.g. "01". */
  index: string;
}

export const MODE_THEME: Record<Mode, ModeTheme> = {
  scene: { Icon: Eye, world: 'Lighthouse Coast', invitation: 'A place to notice', index: '01' },
  story: { Icon: BookOpen, world: 'Sunset Road', invitation: 'A tale to continue', index: '02' },
  mystery: { Icon: Search, world: 'Moonlit Manor', invitation: 'A clue to follow', index: '03' },
  upgrade: { Icon: Pen, world: 'Word Workshop', invitation: 'A sentence to sharpen', index: '04' },
};

export { MODE_ORDER };
