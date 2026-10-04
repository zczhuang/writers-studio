import type { Tier } from '../types';
import { tierVars } from '../data/tones';

/** Compact tier label with a little metal dot. `label` overrides the text (e.g. "Grade unavailable"). */
export function TierChip({ tier, label }: { tier: Tier; label: string }) {
  return (
    <span className="ws-tier-chip" style={tierVars(tier)}>
      <span className="ws-tier-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
