import { ArrowUpRight, Check, Compass, PenLine, Sparkles } from 'lucide-react';
import type { DailyMission } from '../../utils/progression';

interface Props {
  missions: DailyMission[];
  onAction?: (mission: DailyMission) => void;
}

const MISSION_ICONS = {
  'finish-piece': PenLine,
  'word-sprint': Sparkles,
  'mode-explorer': Compass,
} as const;

export function DailyMissionList({ missions, onAction }: Props) {
  const completeCount = missions.filter((mission) => mission.complete).length;
  const allComplete = completeCount === missions.length;

  return (
    <section className="atlas-panel atlas-missions" aria-labelledby="daily-missions-title">
      <div className="atlas-section-heading">
        <div>
          <p className="atlas-kicker">Small steps, real pages</p>
          <h2 id="daily-missions-title" className="atlas-heading atlas-heading-small">Today’s missions</h2>
        </div>
        <span className="atlas-mission-count" aria-label={`${completeCount} of ${missions.length} missions complete`}>
          {completeCount}/{missions.length}
        </span>
      </div>

      {allComplete ? (
        <div className="atlas-mission-celebration">
          <span className="atlas-celebration-mark" aria-hidden="true"><Sparkles size={18} /></span>
          <div>
            <strong>All three are complete.</strong>
            <p>Your atlas has a fresh set of marks today.</p>
          </div>
        </div>
      ) : (
        <div className="atlas-mission-list">
          {missions.map((mission) => {
            const Icon = MISSION_ICONS[mission.id];
            const width = mission.target > 0 ? Math.max(0, Math.min(100, (mission.progress / mission.target) * 100)) : 0;
            return (
              <div className={`atlas-mission ${mission.complete ? 'is-complete' : ''}`} key={mission.id}>
                <span className="atlas-mission-icon" aria-hidden="true">
                  {mission.complete ? <Check size={16} /> : <Icon size={16} />}
                </span>
                <div className="atlas-mission-copy">
                  <div className="atlas-mission-title-row">
                    <strong>{mission.title}</strong>
                    <span>{mission.complete ? 'Done' : mission.detail}</span>
                  </div>
                  <div className="atlas-mini-track" role="progressbar" aria-label={`${mission.title} progress`} aria-valuemin={0} aria-valuemax={mission.target} aria-valuenow={Math.min(mission.target, mission.progress)}>
                    <span style={{ width: `${width}%` }} />
                  </div>
                </div>
                {!mission.complete && onAction && (
                  <button className="atlas-text-button" onClick={() => onAction(mission)}>
                    {mission.actionLabel} <ArrowUpRight size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
