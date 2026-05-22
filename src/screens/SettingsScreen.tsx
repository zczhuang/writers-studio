import { useState } from 'react';
import { KeyRound, ShieldCheck, Coins, RotateCcw, ExternalLink, Download, Lock, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { hashPin, makeSalt } from '../services/pinHash';
import { pushToast } from '../hooks/useToast';
import { testGeminiKey } from '../services/gemini';
import { clearPersistence } from '../state/persistence';

export function SettingsScreen() {
  const { state, dispatch } = useApp();
  const isParent = state.parentUnlockedUntil > Date.now();

  if (!isParent) {
    dispatch({ type: 'REQUEST_PARENT_GATE', target: 'settings' });
    return null;
  }

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

  const save = () => {
    dispatch({ type: 'UPDATE_WRITER', patch: { name: name.trim() || 'Writer' } });
    dispatch({ type: 'SET_SETTINGS', settings: { geminiApiKey: apiKey.trim() || null, geminiModel: model.trim() || 'gemini-2.5-flash', dailyCapDollars: cap, capBehavior } });
    pushToast('Settings saved.', 'success');
  };

  const changePin = async () => {
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
    dispatch({ type: 'SET_SETTINGS', settings: { parentPinHash: hash, parentPinSalt: salt } });
    setPinMode('none');
    setNewPin('');
    setConfirmPin('');
    pushToast('PIN updated.', 'success');
  };

  const testKey = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setKeyOk(null);
    const ok = await testGeminiKey(apiKey.trim(), model.trim() || 'gemini-3.1-flash-lite');
    setKeyOk(ok);
    setTesting(false);
    pushToast(ok ? 'API key works.' : 'API key didn\'t work — check it.', ok ? 'success' : 'warn');
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ writer: state.writer, earnings: state.earnings, entries: state.entries }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `writers-studio-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doReset = () => {
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
            className={`p-3 rounded-lg border text-left ${capBehavior === 'forfeit' ? 'border-gold bg-gold/10 text-text' : 'border-white/10 text-text-muted'}`}
          >
            <div className="font-semibold text-caption">Forfeit</div>
            <div className="text-micro text-text-faint">Keep writing past cap — no extra $.</div>
          </button>
          <button
            onClick={() => setCapBehavior('lock')}
            className={`p-3 rounded-lg border text-left ${capBehavior === 'lock' ? 'border-gold bg-gold/10 text-text' : 'border-white/10 text-text-muted'}`}
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

      <Button variant="gold" fullWidth onClick={save}>Save changes</Button>

      <Section icon={<Download size={16} />} title="Export & reset">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={exportData}>
            <Download size={14} /> Export data as JSON
          </Button>
          {!confirmReset ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)} className="text-rust">
              <RotateCcw size={14} /> Reset everything
            </Button>
          ) : (
            <div className="bg-rust/10 border border-rust/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-rust text-caption font-semibold">
                <AlertTriangle size={14} /> This deletes ALL entries and earnings.
              </div>
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
    <section className="bg-surface border border-white/5 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3 text-gold">
        {icon}
        <h2 className="font-display text-h3 font-semibold text-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}
