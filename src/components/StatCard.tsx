import type { ReactNode } from 'react';

export function StatCard({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="bg-surface border border-white/5 rounded-xl px-4 py-3 flex-1 min-w-0">
      <div className="flex items-center gap-1.5 text-text-faint text-micro uppercase tracking-wider font-semibold mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-display text-h2 font-semibold text-text tabular-nums truncate">{value}</div>
    </div>
  );
}
