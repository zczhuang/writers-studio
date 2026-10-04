import { AlertCircle, Check, CloudOff, HardDrive, Loader2 } from 'lucide-react';
import { useCloudSync } from '../cloud/CloudSyncContext';
import { useApp } from '../state/AppContext';
import { localPersistencePresentation } from '../state/persistence';

export function CloudStatusBadge() {
  const { status, retry } = useCloudSync();
  const { localPersistence } = useApp();
  const local = localPersistencePresentation(localPersistence);
  const localProblem = !localPersistence.ok;
  const retryable = !localProblem && (status.phase === 'error' || status.phase === 'offline');
  const busy = !localProblem && (status.phase === 'saving' || status.phase === 'connecting');

  const Icon = localProblem
    ? AlertCircle
    : status.phase === 'saved'
      ? Check
      : busy
        ? Loader2
        : status.phase === 'error'
          ? AlertCircle
          : status.phase === 'offline'
            ? CloudOff
            : HardDrive;

  const short = localProblem
    ? localPersistence.code === 'unsupported-version' ? 'Update app' : 'Unsaved'
    : status.phase === 'saved'
      ? 'Saved'
      : busy
        ? 'Saving'
        : status.phase === 'error'
          ? 'Retry'
          : status.phase === 'offline'
            ? 'Offline'
            : 'On device';

  const phaseClass = localProblem ? 'error' : status.phase === 'setup-needed' ? 'device-only' : status.phase;
  const label = localProblem
    ? `${local.label}. ${local.detail}`
    : status.phase === 'saved'
      ? 'Backed up to the cloud'
      : retryable
        ? `${status.message}. Tap to retry.`
        : status.phase === 'unavailable' || status.phase === 'device-only' || status.phase === 'setup-needed'
          ? `${local.label}. ${status.message}.`
          : status.message;

  return (
    <button
      type="button"
      className={`ws-pill ws-cloud is-${phaseClass}`}
      onClick={retryable ? retry : undefined}
      disabled={!retryable}
      title={label}
      aria-label={label}
    >
      <Icon size={15} className={busy ? 'animate-spin' : ''} aria-hidden="true" />
      <span className="ws-cloud-label">{short}</span>
    </button>
  );
}
