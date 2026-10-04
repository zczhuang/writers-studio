import { AlertCircle, Check, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useCloudSync } from '../cloud/CloudSyncContext';
import { useApp } from '../state/AppContext';
import { localPersistencePresentation } from '../state/persistence';

export function CloudStatusBadge() {
  const { status, retry } = useCloudSync();
  const { localPersistence } = useApp();
  const local = localPersistencePresentation(localPersistence);
  const localProblem = !localPersistence.ok;
  const retryable = status.phase === 'error' || status.phase === 'offline';
  const Icon =
    localProblem
      ? AlertCircle
      : status.phase === 'saved'
      ? Check
      : status.phase === 'saving' || status.phase === 'connecting'
        ? Loader2
        : status.phase === 'error'
          ? AlertCircle
          : status.phase === 'offline'
            ? CloudOff
            : Cloud;
  const label = localProblem ? local.label : status.phase === 'saved' ? 'Cloud saved' : status.message;
  const phase = localProblem ? 'error' : status.phase;
  return (
    <button
      type="button"
      className={`atlas-cloud-status is-${phase}${retryable && !localProblem ? ' is-retryable' : ''}`}
      onClick={retryable && !localProblem ? retry : undefined}
      disabled={!retryable || localProblem}
      title={localProblem ? `${local.detail} Cloud: ${status.message}` : retryable ? `${label}. Tap to retry.` : label}
      aria-label={localProblem ? `${local.label}. ${local.detail}` : retryable ? `${label}. Retry cloud save.` : label}
    >
      <Icon size={13} className={!localProblem && (status.phase === 'saving' || status.phase === 'connecting') ? 'animate-spin' : ''} aria-hidden="true" />
      <span>{localProblem ? (localPersistence.code === 'unsupported-version' ? 'Update app' : 'Unsaved') : status.phase === 'saved' ? 'Saved' : status.phase === 'unavailable' || status.phase === 'device-only' ? 'Local ready' : status.phase}</span>
    </button>
  );
}
