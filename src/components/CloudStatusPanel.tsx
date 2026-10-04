import { RefreshCw } from 'lucide-react';
import { useCloudSync } from '../cloud/CloudSyncContext';
import type { CloudStatus } from '../cloud/syncEngine';
import { useApp } from '../state/AppContext';
import { localPersistencePresentation } from '../state/persistence';
import { Button } from './ui/Button';

type Tone = 'ok' | 'warn' | 'pending';

interface CloudPresentation {
  tone: Tone;
  title: string;
  detail: string;
}

function lastSaved(status: CloudStatus): string | null {
  if (!status.lastSavedAt) return null;
  const at = new Date(status.lastSavedAt);
  return Number.isNaN(at.getTime()) ? null : at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function cloudPresentation(status: CloudStatus, configured: boolean): CloudPresentation {
  const saved = lastSaved(status);
  switch (status.phase) {
    case 'saved':
      return { tone: 'ok', title: 'Backed up to the cloud', detail: saved ? `Last cloud save ${saved}.` : 'The latest progress is in the cloud database.' };
    case 'saving':
    case 'connecting':
      return { tone: 'pending', title: 'Backing up…', detail: status.message };
    case 'offline':
      return { tone: 'pending', title: 'Offline right now', detail: `Progress is safe on this device and will back up when the connection returns.${saved ? ` Last cloud save ${saved}.` : ''}` };
    case 'device-only':
      return { tone: 'pending', title: 'Waiting for the first piece', detail: 'The cloud copy starts after the first piece is finished. Blank profiles are never uploaded.' };
    case 'setup-needed':
      return { tone: 'warn', title: 'Cloud backup needs one setup step', detail: 'Anonymous sign-ins are turned off in the Supabase project, so progress is staying on this device. Turn them on in Supabase → Authentication → Sign In / Providers.' };
    case 'error':
      return { tone: 'warn', title: status.message, detail: `Progress is still saved on this device. It retries automatically.${saved ? ` Last cloud save ${saved}.` : ''}` };
    case 'unavailable':
    default:
      return configured
        ? { tone: 'pending', title: 'Cloud backup is starting', detail: status.message }
        : { tone: 'warn', title: 'Cloud backup is not connected', detail: 'Progress is saved in this browser only. Clearing site data or switching devices would lose it until a cloud database is connected.' };
  }
}

/** Parent-facing summary of where progress is saved: this device and the cloud database. */
export function CloudStatusPanel() {
  const { state, localPersistence } = useApp();
  const cloud = useCloudSync();
  const local = localPersistencePresentation(localPersistence);
  const presentation = cloudPresentation(cloud.status, cloud.configured);
  const retryable = cloud.status.phase === 'error' || cloud.status.phase === 'offline' || cloud.status.phase === 'setup-needed';

  return (
    <div className="ws-sync-panel">
      <div className={`ws-sync-status ${localPersistence.ok ? 'is-ok' : 'is-warn'}`}>
        <div className="min-w-0">
          <div className="ws-sync-title"><span className={`ws-dot ${localPersistence.ok ? 'is-ok' : 'is-warn'}`} aria-hidden="true" /> {local.label}</div>
          <div className="ws-sync-detail">{local.detail} {state.entries.length} {state.entries.length === 1 ? 'piece' : 'pieces'} and {state.writer.xp.toLocaleString()} XP on this device.</div>
        </div>
      </div>
      <div className={`ws-sync-status is-${presentation.tone}`} role="status">
        <div className="min-w-0">
          <div className="ws-sync-title"><span className={`ws-dot is-${presentation.tone}`} aria-hidden="true" /> {presentation.title}</div>
          <div className="ws-sync-detail">{presentation.detail}</div>
        </div>
        {retryable && cloud.configured && (
          <Button variant="ghost" size="sm" onClick={cloud.retry}><RefreshCw size={14} aria-hidden="true" /> Retry</Button>
        )}
      </div>
    </div>
  );
}
