import { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck, Coins, RotateCcw, ExternalLink, Download, Lock, AlertTriangle, Loader2, CheckCircle2, Cloud, Copy, Upload, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { hashPin, makeSalt } from '../services/pinHash';
import { pushToast } from '../hooks/useToast';
import { testGeminiKey } from '../services/gemini';
import { allowPersistenceWrites, clearPersistence, localPersistencePresentation } from '../state/persistence';
import { browserDeadlineRuntime, parentAccessIsActive, startDeadlineWatcher } from '../services/accessTiming';
import { useCloudSync } from '../cloud/CloudSyncContext';
import { createExportBundle, mergeAppStates, parseImportBundle } from '../cloud/model';
import { formatRecoveryCode, isRecoveryCode, normalizeRecoveryCode } from '../cloud/recovery';
import { hasMeaningfulProgress } from '../state/normalization';

export function SettingsScreen() {
  const { state, dispatch, localPersistence } = useApp();
  const cloud = useCloudSync();
  const latestStateRef = useRef(state);
  const [name, setName] = useState(state.writer.name);
  const [apiKey, setApiKey] = useState(state.settings.geminiApiKey ?? '');
  const [model, setModel] = useState(state.settings.geminiModel);
  const [cap, setCap] = useState(state.settings.dailyCapDollars);
  const [capBehavior, setCapBehavior] = useState(state.settings.capBehavior);
  const [pinMode, setPinMode] = useState<'none' | 'set' | 'confirm'>('none');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [testing, setTesting] = useState(false);
  const [keyOk, setKeyOk] = useState<null | boolean>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [authNow, setAuthNow] = useState(() => Date.now());
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [importing, setImporting] = useState(false);
  const isParent = state.parentUnlockedUntil > authNow;
  const localSave = localPersistencePresentation(localPersistence);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(
    () =>
      startDeadlineWatcher({
        deadlineMs: state.parentUnlockedUntil,
        onTime: setAuthNow,
        runtime: browserDeadlineRuntime(),
      }),
    [state.parentUnlockedUntil]
  );

  useEffect(() => {
    if (!isParent) dispatch({ type: 'REQUEST_PARENT_GATE', target: 'settings' });
  }, [dispatch, isParent]);

  if (!isParent) return null;

  const ensureParentAccess = () => {
    if (parentAccessIsActive(state.parentUnlockedUntil)) return true;
    dispatch({ type: 'REQUEST_PARENT_GATE', target: 'settings' });
    return false;
  };

  const save = () => {
    if (!ensureParentAccess()) return;
    dispatch({ type: 'UPDATE_WRITER', patch: { name: name.trim() || 'Writer' } });
    dispatch({ type: 'SET_SETTINGS', settings: { geminiApiKey: apiKey.trim() || null, geminiModel: model.trim() || 'gemini-2.5-flash', dailyCapDollars: cap, capBehavior } });
    pushToast('Settings updated.', 'success');
  };

  const changePin = async () => {
    if (!ensureParentAccess()) return;
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      pushToast('PIN must be 4 digits.', 'warn');
      return;
    }
    if (newPin !== confirmPin) {
      pushToast('PINs don\'t match.', 'warn');
      return;
    }
    const salt = makeSalt();
    const hash = await hashPin(newPin, salt);
    if (!ensureParentAccess()) return;
    dispatch({ type: 'SET_SETTINGS', settings: { parentPinHash: hash, parentPinSalt: salt } });
    setPinMode('none');
    setNewPin('');
    setConfirmPin('');
    pushToast('PIN updated.', 'success');
  };

  const testKey = async () => {
    if (!ensureParentAccess()) return;
    if (!apiKey.trim()) return;
    setTesting(true);
    setKeyOk(null);
    const ok = await testGeminiKey(apiKey.trim(), model.trim() || 'gemini-3.1-flash-lite');
    if (!ensureParentAccess()) {
      setTesting(false);
      return;
    }
    setKeyOk(ok);
    setTesting(false);
    pushToast(ok ? 'API key works.' : 'API key didn\'t work — check it.', ok ? 'success' : 'warn');
  };

  const exportData = () => {
    if (!ensureParentAccess()) return;
    const bundle = createExportBundle(latestStateRef.current);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `writers-studio-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const recoveryCode = showRecoveryCode ? cloud.getRecoveryCode(state.parentUnlockedUntil) : null;

  const revealRecoveryCode = () => {
    if (!ensureParentAccess()) return;
    setShowRecoveryCode((visible) => !visible);
  };

  const copyRecoveryCode = async () => {
    if (!ensureParentAccess()) return;
    const code = cloud.getRecoveryCode(state.parentUnlockedUntil);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      if (!ensureParentAccess()) return;
      pushToast('Recovery code copied. Keep it somewhere private.', 'success');
    } catch {
      if (ensureParentAccess()) pushToast('Could not copy. You can write down the code instead.', 'warn');
    }
  };

  const downloadRecoveryCode = () => {
    if (!ensureParentAccess()) return;
    const code = cloud.getRecoveryCode(state.parentUnlockedUntil);
    if (!code) return;
    const body = `Writer's Studio recovery code\n\n${code}\n\nKeep this private. It can restore the writing history on another device. The four-digit app and parent PINs cannot restore cloud history.\n`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'writers-studio-recovery-code.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const recoverHistory = async () => {
    if (!ensureParentAccess()) return;
    const code = normalizeRecoveryCode(recoveryInput);
    if (!isRecoveryCode(code)) {
      pushToast('Recovery codes are 43 letters and numbers. Check the full code.', 'warn');
      return;
    }
    const deadline = state.parentUnlockedUntil;
    setRecovering(true);
    const result = await cloud.recover(code, deadline);
    setRecovering(false);
    if (!parentAccessIsActive(deadline)) {
      dispatch({ type: 'REQUEST_PARENT_GATE', target: 'settings' });
      return;
    }
    if (result.ok) {
      setRecoveryInput('');
      setShowRecoveryCode(true);
      pushToast('Writing history restored and linked to this device.', 'success');
    } else if (result.reason === 'rate_limited') {
      pushToast('Too many tries. Please wait a little before trying again.', 'warn');
    } else if (result.reason === 'invalid') {
      pushToast('That recovery code did not match.', 'warn');
    } else if (result.reason === 'unavailable') {
      pushToast('Cloud backup is not set up on this copy of the app.', 'warn');
    } else if (result.reason !== 'expired') {
      pushToast('Could not restore yet. Nothing on this device was changed.', 'warn');
    }
  };

  const importData = async (file: File | undefined) => {
    if (!file || !ensureParentAccess()) return;
    const deadline = state.parentUnlockedUntil;
    setImporting(true);
    try {
      const text = await file.text();
      if (!parentAccessIsActive(deadline)) {
        dispatch({ type: 'REQUEST_PARENT_GATE', target: 'settings' });
        return;
      }
      const imported = parseImportBundle(text);
      const current = latestStateRef.current;
      const merged = mergeAppStates(current, imported, !hasMeaningfulProgress(current));
      if (!parentAccessIsActive(deadline)) {
        dispatch({ type: 'REQUEST_PARENT_GATE', target: 'settings' });
        return;
      }
      allowPersistenceWrites();
      dispatch({ type: 'APPLY_SYNC_STATE', payload: merged });
      pushToast('Backup added. Existing writing and rewards were kept.', 'success');
    } catch {
      if (parentAccessIsActive(deadline)) pushToast('That file is not a readable Writer’s Studio backup.', 'warn');
    } finally {
      setImporting(false);
    }
  };

  const doReset = () => {
    if (!ensureParentAccess()) return;
    if (!cloud.startNewLineage()) {
      pushToast('Reset stopped: cloud recovery details could not be archived. Free browser storage, export a backup, then try again.', 'warn');
      return;
    }
    clearPersistence();
    dispatch({ type: 'RESET_ALL' });
    pushToast('Everything reset. Fresh start.', 'info');
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <header>
        <div className="flex items-center gap-2 text-gold mb-1">
          <Lock size={14} />
          <span className="text-micro uppercase tracking-wider font-semibold">Parent settings</span>
        </div>
        <h1 className="font-display text-h1 font-semibold text-text">Settings</h1>
      </header>

      <Section icon={<ShieldCheck size={16} />} title="Writer">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      </Section>

      <Section icon={<KeyRound size={16} />} title="AI coach (Gemini)">
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-caption text-gold hover:text-gold-bright underline underline-offset-2 mb-3"
        >
          Get an API key <ExternalLink size={12} />
        </a>
        <Input
          label="API Key"
          type="password"
          placeholder="paste your Gemini API key"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setKeyOk(null); }}
          hint="Stays on this device. Only sent to Google's Gemini API."
        />
        <div className="mt-3">
          <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} hint="e.g. gemini-3.1-flash-lite" />
        </div>
        <Button variant="ghost" size="sm" onClick={testKey} className="mt-3" disabled={!apiKey.trim() || testing}>
          {testing ? <Loader2 size={14} className="animate-spin" /> : keyOk ? <CheckCircle2 size={14} className="text-moss" /> : null}
          {testing ? 'Testing…' : keyOk === true ? 'Key works' : 'Test key'}
        </Button>
      </Section>

      <Section icon={<Coins size={16} />} title="Daily cap">
        <div className="text-center font-mono text-h1 font-semibold text-gold tabular-nums mb-2">
          ${cap.toFixed(2)}
        </div>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.25"
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="w-full accent-gold"
        />
        <div className="flex justify-between text-micro text-text-faint mt-1">
          <span>$0.50</span><span>$5.00</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setCapBehavior('forfeit')}
            className={`p-3 rounded-lg border text-left ${capBehavior === 'forfeit' ? 'border-gold bg-gold/10 text-text' : 'border-line-2 text-text-muted'}`}
          >
            <div className="font-semibold text-caption">Forfeit</div>
            <div className="text-micro text-text-faint">Keep writing past cap — no extra $.</div>
          </button>
          <button
            onClick={() => setCapBehavior('lock')}
            className={`p-3 rounded-lg border text-left ${capBehavior === 'lock' ? 'border-gold bg-gold/10 text-text' : 'border-line-2 text-text-muted'}`}
          >
            <div className="font-semibold text-caption">Lock</div>
            <div className="text-micro text-text-faint">Block submit until tomorrow.</div>
          </button>
        </div>
      </Section>

      <Section icon={<ShieldCheck size={16} />} title="Parent PIN">
        {pinMode === 'none' && (
          <Button variant="ghost" size="sm" onClick={() => setPinMode('set')}>
            Change PIN
          </Button>
        )}
        {(pinMode === 'set' || pinMode === 'confirm') && (
          <div className="space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              label="New PIN (4 digits)"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              label="Confirm new PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setPinMode('none'); setNewPin(''); setConfirmPin(''); }}>Cancel</Button>
              <Button variant="gold" size="sm" onClick={changePin}>Save PIN</Button>
            </div>
          </div>
        )}
      </Section>

      <Section icon={<Cloud size={16} />} title="Cloud backup & recovery">
        <div className="space-y-3">
          <div className={`rounded-lg border p-3 ${localPersistence.ok ? 'border-line bg-paper/50' : 'border-rust/30 bg-rust/10'}`}>
            <div className={`text-caption font-semibold ${localPersistence.ok ? 'text-text' : 'text-rust'}`}>{localSave.label}</div>
            <div className="text-micro text-text-faint mt-1">{localSave.detail}</div>
          </div>
          <div className="rounded-lg border border-line bg-paper/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-caption font-semibold text-text">{cloud.status.message}</div>
                <div className="text-micro text-text-faint mt-1">
                  {cloud.status.lastSavedAt
                    ? `Last cloud save ${new Date(cloud.status.lastSavedAt).toLocaleString()}`
                    : cloud.configured
                      ? 'Writing stays on this device until there is history to back up.'
                      : 'Cloud backup is not configured. Local storage status is shown above.'}
                </div>
              </div>
              {(cloud.status.phase === 'error' || cloud.status.phase === 'offline') && (
                <Button variant="ghost" size="sm" onClick={cloud.retry}><RefreshCw size={14} /> Retry</Button>
              )}
            </div>
          </div>

          <p className="text-caption text-text-muted leading-relaxed">
            A private recovery code links another device without an email or child login. Keep it somewhere only a parent can reach. The four-digit PIN is never used as this code.
          </p>

          {cloud.configured && (
            <div className="space-y-2">
              <Button variant="ghost" size="sm" onClick={revealRecoveryCode}>
                {showRecoveryCode ? <EyeOff size={14} /> : <Eye size={14} />}
                {showRecoveryCode ? 'Hide recovery code' : 'Show recovery code'}
              </Button>
              {showRecoveryCode && (
                recoveryCode ? (
                  <div className="rounded-lg border border-gold/30 bg-gold/10 p-3 space-y-3">
                    <code className="block break-all font-mono text-caption leading-relaxed text-text select-all">{formatRecoveryCode(recoveryCode)}</code>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" onClick={copyRecoveryCode}><Copy size={14} /> Copy</Button>
                      <Button variant="ghost" size="sm" onClick={downloadRecoveryCode}><Download size={14} /> Save as file</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-caption text-text-muted">The code will appear after the first piece is backed up.</p>
                )
              )}
            </div>
          )}

          <div className="border-t border-line pt-3 space-y-2">
            <Input
              label="Restore with a recovery code"
              value={recoveryInput}
              onChange={(event) => setRecoveryInput(event.target.value)}
              placeholder="Paste the 43-character code"
              autoComplete="off"
            />
            <Button variant="ghost" size="sm" onClick={recoverHistory} disabled={!cloud.configured || recovering || !recoveryInput.trim()}>
              {recovering ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
              {recovering ? 'Restoring…' : 'Restore & link this device'}
            </Button>
          </div>
        </div>
      </Section>

      <Button variant="gold" fullWidth onClick={save}>Save changes</Button>

      <Section icon={<Download size={16} />} title="Export, import & reset">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={exportData}>
            <Download size={14} /> Export data as JSON
          </Button>
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-caption font-medium text-text-muted hover:bg-surface-2">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {importing ? 'Importing…' : 'Add data from a backup'}
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void importData(file);
              }}
            />
          </label>
          <p className="text-micro text-text-faint leading-relaxed">Exports include writing, rewards, progress, memory, craft, and draft history. They never include PINs, API keys, sign-in tokens, or the cloud recovery code. Imports add to what is already here.</p>
          {!confirmReset ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)} className="text-rust">
              <RotateCcw size={14} /> Reset everything
            </Button>
          ) : (
            <div className="bg-rust/10 border border-rust/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-rust text-caption font-semibold">
                <AlertTriangle size={14} /> This starts a new blank writing line on this device.
              </div>
              <p className="text-micro text-text-muted">Old cloud backups are not deleted. Save the current recovery code first if you may need them.</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
                <Button variant="danger" size="sm" onClick={doReset}>Yes, reset</Button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3 text-gold">
        {icon}
        <h2 className="font-display text-h3 font-semibold text-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}
