import { ArrowUpRight, Check, Compass, PenLine, Sparkles, Target } from 'lucide-react';
import type { DailyMission } from '../../utils/progression';
import { toneVars, type ToneName } from '../../data/tones';
import { ProgressRing } from '../art/ProgressRing';

interface Props {
  missions: DailyMission[];
  onAction?: (mission: DailyMission) => void;
}

const MISSION_ICONS = {
  'finish-piece': PenLine,
  'word-sprint': Sparkles,
  'mode-explorer': Compass,
} as const;

const MISSION_TONES: Record<DailyMission['id'], ToneName> = {
  'finish-piece': 'story',
  'word-sprint': 'mystery',
  'mode-explorer': 'scene',
};

export function DailyMissionList({ missions, onAction }: Props) {
  const completeCount = missions.filter((mission) => mission.complete).length;
  const allComplete = completeCount === missions.length;
  const pct = missions.length > 0 ? (completeCount / missions.length) * 100 : 0;

  return (
    <section className="ws-card ws-card-pad" aria-labelledby="daily-missions-title">
      <div className="ws-section-head">
        <div>
          <p className="ws-kicker"><Target size={14} aria-hidden="true" /> Small steps, real pages</p>
          <h2 id="daily-missions-title" className="ws-h2">Today&apos;s missions</h2>
        </div>
        <ProgressRing pct={pct} size={52} stroke={5} label={`${completeCount} of ${missions.length} missions complete`} style={toneVars('success')}>
          <span className="text-[0.82rem] font-extrabold tabular-nums text-ink">{completeCount}/{missions.length}</span>
        </ProgressRing>
      </div>

      {allComplete ? (
        <div className="ws-mission-done">
          <span className="ws-medallion ws-medallion--lg ws-medallion--solid" style={toneVars('gold')} aria-hidden="true"><Sparkles size={24} /></span>
          <div>
            <strong>All three missions complete!</strong>
            <p>Your atlas has a fresh set of marks today. Anything else you write is a bonus.</p>
          </div>
        </div>
      ) : (
        <ul className="ws-missions">
          {missions.map((mission) => {
            const Icon = MISSION_ICONS[mission.id];
            const width = mission.target > 0 ? Math.max(0, Math.min(100, (mission.progress / mission.target) * 100)) : 0;
            return (
              <li className={`ws-mission ${mission.complete ? 'is-complete' : ''}`} key={mission.id} style={toneVars(MISSION_TONES[mission.id])}>
                <span className="ws-mission-check" aria-hidden="true">
                  {mission.complete ? <Check size={18} strokeWidth={2.6} /> : <Icon size={18} />}
                </span>
                <div className="ws-mission-body">
                  <div className="ws-mission-row">
                    <strong>{mission.title}</strong>
                    <span>{mission.complete ? 'Done' : mission.detail}</span>
                  </div>
                  <div
                    className="ws-progress ws-progress--thin"
                    style={mission.complete ? toneVars('success') : undefined}
                    role="progressbar"
                    aria-label={`${mission.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={mission.target}
                    aria-valuenow={Math.min(mission.target, mission.progress)}
                  >
                    <span style={{ width: `${width}%` }} />
                  </div>
                </div>
                {!mission.complete && onAction && (
                  <button type="button" className="ws-link-btn" onClick={() => onAction(mission)}>
                    {mission.actionLabel} <ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
