const EXPIRY_GRACE_MS = 25;

export interface DeadlineWatcherRuntime {
  now: () => number;
  setTimer: (callback: () => void, delayMs: number) => number;
  clearTimer: (timerId: number) => void;
  subscribeFocus: (callback: () => void) => () => void;
  subscribeVisible: (callback: () => void) => () => void;
}

interface StartDeadlineWatcherInput {
  deadlineMs: number;
  onTime: (nowMs: number) => void;
  runtime: DeadlineWatcherRuntime;
  tickEveryMs?: number;
}

export function parentAccessIsActive(untilMs: number, nowMs: number = Date.now()): boolean {
  return untilMs > nowMs;
}

export function remainingCooldownSeconds(untilMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((untilMs - nowMs) / 1000));
}

/**
 * Notify a mounted protected view at its deadline and whenever the page returns
 * to the foreground. An optional cadence also supports a visible countdown.
 */
export function startDeadlineWatcher({
  deadlineMs,
  onTime,
  runtime,
  tickEveryMs,
}: StartDeadlineWatcherInput): () => void {
  let timerId: number | null = null;
  let stopped = false;

  const schedule = () => {
    if (timerId !== null) runtime.clearTimer(timerId);
    const remainingMs = deadlineMs - runtime.now();
    if (remainingMs <= 0) {
      timerId = null;
      return;
    }

    const deadlineDelay = remainingMs + EXPIRY_GRACE_MS;
    const delayMs = tickEveryMs ? Math.min(tickEveryMs, deadlineDelay) : deadlineDelay;
    timerId = runtime.setTimer(resync, Math.max(1, delayMs));
  };

  const resync = () => {
    if (stopped) return;
    onTime(runtime.now());
    schedule();
  };

  const unsubscribeFocus = runtime.subscribeFocus(resync);
  const unsubscribeVisible = runtime.subscribeVisible(resync);
  schedule();

  return () => {
    stopped = true;
    if (timerId !== null) runtime.clearTimer(timerId);
    unsubscribeFocus();
    unsubscribeVisible();
  };
}

export function browserDeadlineRuntime(): DeadlineWatcherRuntime {
  return {
    now: () => Date.now(),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timerId) => window.clearTimeout(timerId),
    subscribeFocus: (callback) => {
      window.addEventListener('focus', callback);
      return () => window.removeEventListener('focus', callback);
    },
    subscribeVisible: (callback) => {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') callback();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
