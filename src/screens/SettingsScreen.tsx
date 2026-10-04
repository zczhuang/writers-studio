import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { KeyRound, ShieldCheck, Coins, RotateCcw, ExternalLink, Download, AlertTriangle, Loader2, CheckCircle2, Cloud, Copy, Upload, Eye, EyeOff, UserRound, Save, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { hashPin, makeSalt } from '../services/pinHash';
import { pushToast } from '../hooks/useToast';
import { testGeminiKey } from '../services/gemini';
import { allowPersistenceWrites, clearPersistence } from '../state/persistence';
import { browserDeadlineRuntime, parentAccessIsActive, startDeadlineWatcher } from '../services/accessTiming';
import { useCloudSync } from '../cloud/CloudSyncContext';
import { createExportBundle, mergeAppStates, parseImportBundle } from '../cloud/model';
import { formatRecoveryCode, isRecoveryCode, normalizeRecoveryCode } from '../cloud/recovery';
import { hasMeaningfulProgress } from '../state/normalization';
import { toneVars, type ToneName } from '../data/tones';
import { StarField } from '../components/art/StarField';
import { CloudStatusPanel } from '../components/CloudStatusPanel';

export function SettingsScreen() {
  const { state, dispatch } = useApp();
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
    <div className="ws-page">
      <section className="ws-parent-head ws-night ws-rise" aria-labelledby="settings-title">
        <StarField seed={19} count={28} sparkles={3} />
        <div>
          <span className="ws-parent-badge"><SettingsIcon size={14} aria-hidden="true" /> Parent settings</span>
          <h1 id="settings-title" className="ws-h1 mt-3">Settings</h1>
          <p className="ws-lede">Coach, rewards, PIN, and where {state.writer.name}&apos;s progress is saved.</p>
        </div>
      </section>

      <Section tone="story" icon={<UserRound size={18} />} title="Writer">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      </Section>

      <Section tone="mystery" icon={<KeyRound size={18} />} title="AI coach (Gemini)">
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-bold text-gold-deep underline underline-offset-4"
        >
          Get an API key <ExternalLink size={13} aria-hidden="true" />
        </a>
        <div className="grid gap-3">
          <Input
            label="API key"
            type="password"
            placeholder="Paste your Gemini API key"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setKeyOk(null); }}
            hint="Stays on this device. Only sent to Google's Gemini API."
          />
          <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} hint="e.g. gemini-3.1-flash-lite" />
        </div>
        <Button variant="ghost" size="sm" onClick={testKey} className="mt-3" disabled={!apiKey.trim() || testing}>
          {testing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : keyOk ? <CheckCircle2 size={15} className="text-moss" aria-hidden="true" /> : null}
          {testing ? 'Testing…' : keyOk === true ? 'Key works' : 'Test key'}
        </Button>
      </Section>

      <Section tone="gold" icon={<Coins size={18} />} title="Daily cap">
        <div className="ws-cap-value">${cap.toFixed(2)}</div>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.25"
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="ws-range"
          aria-label="Daily cap in dollars"
          style={{ '--fill': `${((cap - 0.5) / 4.5) * 100}%` } as CSSProperties}
        />
        <div className="ws-range-scale"><span>$0.50</span><span>$5.00</span></div>
        <div className="ws-toggle-grid mt-4" role="radiogroup" aria-label="When the daily cap is reached">
          <button
            type="button"
            role="radio"
            aria-checked={capBehavior === 'forfeit'}
            onClick={() => setCapBehavior('forfeit')}
            className={`ws-toggle ${capBehavior === 'forfeit' ? 'is-active' : ''}`}
          >
            <strong>Keep writing</strong>
            <span>Pieces past the cap count for practice, with no extra money.</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={capBehavior === 'lock'}
            onClick={() => setCapBehavior('lock')}
            className={`ws-toggle ${capBehavior === 'lock' ? 'is-active' : ''}`}
          >
            <strong>Lock until tomorrow</strong>
            <span>Submitting pauses once the cap is reached. Drafts stay saved.</span>
          </button>
        </div>
      </Section>

      <Button variant="gold" size="lg" fullWidth onClick={save}><Save size={18} aria-hidden="true" /> Save changes</Button>

      <Section tone="night" icon={<ShieldCheck size={18} />} title="Parent PIN">
        {pinMode === 'none' && (
          <Button variant="ghost" size="sm" onClick={() => setPinMode('set')}>
            Change PIN
          </Button>
        )}
        {(pinMode === 'set' || pinMode === 'confirm') && (
          <div className="grid gap-3">
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

      <Section tone="scene" icon={<Cloud size={18} />} title="Cloud backup & recovery">
        <div className="grid gap-4">
          <CloudStatusPanel />

          <p className="ws-body m-0">
            A private recovery code links another device without an email or child login. Keep it somewhere only a parent can reach. The four-digit PIN is never used as this code.
          </p>

          {cloud.configured && (
            <div className="grid gap-2">
              <div>
                <Button variant="ghost" size="sm" onClick={revealRecoveryCode}>
                  {showRecoveryCode ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                  {showRecoveryCode ? 'Hide recovery code' : 'Show recovery code'}
                </Button>
              </div>
              {showRecoveryCode && (
                recoveryCode ? (
                  <div className="grid gap-3">
                    <code className="ws-code">{formatRecoveryCode(recoveryCode)}</code>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" onClick={copyRecoveryCode}><Copy size={15} aria-hidden="true" /> Copy</Button>
                      <Button variant="ghost" size="sm" onClick={downloadRecoveryCode}><Download size={15} aria-hidden="true" /> Save as file</Button>
                    </div>
                  </div>
                ) : (
                  <p className="ws-small m-0">The code appears after the first piece is backed up.</p>
                )
              )}
            </div>
          )}

          <div className="grid gap-2 border-t border-line pt-4">
            <Input
              label="Restore with a recovery code"
              value={recoveryInput}
              onChange={(event) => setRecoveryInput(event.target.value)}
              placeholder="Paste the 43-character code"
              autoComplete="off"
            />
            <div>
              <Button variant="ghost" size="sm" onClick={recoverHistory} disabled={!cloud.configured || recovering || !recoveryInput.trim()}>
                {recovering ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Cloud size={15} aria-hidden="true" />}
                {recovering ? 'Restoring…' : 'Restore & link this device'}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="neutral" icon={<Download size={18} />} title="Export, import & reset">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={exportData}>
              <Download size={15} aria-hidden="true" /> Export data as JSON
            </Button>
            <label className="ws-btn ws-btn--ghost ws-btn--sm cursor-pointer">
              {importing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
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
          </div>
          <p className="ws-small m-0">Exports include writing, rewards, progress, memory, craft, and draft history. They never include PINs, API keys, sign-in tokens, or the cloud recovery code. Imports add to what is already here.</p>
          {!confirmReset ? (
            <div>
              <Button variant="danger-ghost" size="sm" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={15} aria-hidden="true" /> Reset everything
              </Button>
            </div>
          ) : (
            <div className="ws-callout ws-callout--warn" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              <div className="grid gap-2">
                <strong>This starts a new blank writing line on this device.</strong>
                <span className="ws-small">Old cloud backups are not deleted. Save the current recovery code first if you may need them.</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
                  <Button variant="danger" size="sm" onClick={doReset}>Yes, reset</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ tone, icon, title, children }: { tone: ToneName; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="ws-card ws-settings-section">
      <div className="ws-settings-head" style={toneVars(tone)}>
        <span className="ws-medallion ws-medallion--sm" aria-hidden="true">{icon}</span>
        <h2 className="ws-h3">{title}</h2>
      </div>
      {children}
    </section>
  );
}
