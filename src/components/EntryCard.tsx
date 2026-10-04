import type { Entry } from '../types';
import { MODE_META } from '../data/prompts';
import { MODE_THEME } from '../data/modeTheme';
import { toneVars } from '../data/tones';
import { prettyDate } from '../utils/date';
import { gradingPresentation } from '../services/gradingPresentation';
import { TierChip } from './TierChip';

interface Props {
  entry: Entry;
  onClick?: () => void;
}

export function EntryCard({ entry, onClick }: Props) {
  const meta = MODE_META[entry.mode];
  const theme = MODE_THEME[entry.mode];
  const preview = entry.text.length > 220 ? entry.text.slice(0, 220).trimEnd() + '…' : entry.text;
  const grade = gradingPresentation(entry);
  const drafts = (entry.revisionCount ?? 0) + 1;
  return (
    <button type="button" onClick={onClick} className="ws-entry" style={toneVars(entry.mode)}>
      <span className="ws-entry-head">
        <span className="ws-entry-world"><theme.Icon size={13} aria-hidden="true" /> {meta.label}</span>
        <span>{prettyDate(entry.createdAt)}</span>
      </span>
      <span className="ws-entry-title">{entry.challengeTitle}</span>
      <span className="ws-entry-excerpt">{preview}</span>
      <span className="ws-entry-foot">
        <TierChip tier={grade.available ? entry.judge.tier : 'none'} label={grade.tierText} />
        {grade.available && <span>{grade.scoreText}</span>}
        <span>{entry.wordCount} words</span>
        {drafts > 1 && <span>{drafts} drafts</span>}
      </span>
    </button>
  );
}
