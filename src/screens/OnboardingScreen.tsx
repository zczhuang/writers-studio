import { useState } from 'react';
import { ArrowRight, Feather, ShieldCheck, KeyRound, Coins, ExternalLink, Check } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PinPad } from '../components/ui/PinPad';
import { hashPin, makeSalt } from '../services/pinHash';
import { pushToast } from '../hooks/useToast';

type Step = 'welcome' | 'name' | 'pin' | 'pin-confirm' | 'key' | 'cap' | 'done';

export function OnboardingScreen() {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(state.writer.name === 'Writer' ? '' : state.writer.name);
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');
  const [shake, setShake] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [cap, setCap] = useState(1.5);

  const go = (next: Step) => setStep(next);

  const onPin = async (pin: string) => {
    if (step === 'pin') { setFirstPin(pin); go('pin-confirm'); return; }
    if (step === 'pin-confirm') {
      if (pin !== firstPin) {
        setPinError("Didn't match. Try again.");
        setShake((s) => s + 1);
        setFirstPin(null);
        go('pin');
        return;
      }
      const salt = makeSalt();
      const hash = await hashPin(pin, salt);
      dispatch({ type: 'SET_SETTINGS', settings: { parentPinHash: hash, parentPinSalt: salt } });
      setPinError('');
      go('key');
    }
  };

  const finish = () => {
    dispatch({ type: 'UPDATE_WRITER', patch: { name: name.trim() || 'Writer' } });
    dispatch({ type: 'SET_SETTINGS', settings: { dailyCapDollars: cap, geminiApiKey: apiKey.trim() || null } });
    dispatch({ type: 'NAV_RESET', screen: 'home' });
    pushToast(`Welcome to Writer's Studio, ${name.trim() || 'Writer'}.`, 'success');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        {step === 'welcome' && (
          <div className="text-center space-y-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold/15 text-gold">
              <Feather size={26} />
            </div>
            <h1 className="font-display text-display font-semibold text-text leading-tight">Writer's Studio</h1>
            <p className="text-text-muted font-serif italic">
              Real writing. Real feedback. Real money for real work.
            </p>
            <Button variant="gold" fullWidth onClick={() => go('name')}>
              Begin <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {step === 'name' && (
          <Card>
            <h2 className="font-display text-h1 font-semibold text-text mb-2">What's your name, writer?</h2>
            <p className="text-caption text-text-muted mb-5">Used to greet you. You can change this later.</p>
            <Input
              autoFocus
              placeholder="e.g. Maya"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="mt-5 flex gap-2">
              <Button variant="ghost" onClick={() => { setName(''); go('pin'); }} className="flex-1">Skip</Button>
              <Button variant="gold" onClick={() => go('pin')} className="flex-[2]">
                Continue <ArrowRight size={16} />
              </Button>
            </div>
          </Card>
        )}

        {(step === 'pin' || step === 'pin-confirm') && (
          <Card>
            <div className="flex items-center gap-2 mb-2 text-gold">
              <ShieldCheck size={18} />
              <span className="text-micro uppercase tracking-wider font-semibold">Parent Setup</span>
            </div>
            <h2 className="font-display text-h1 font-semibold text-text mb-2">
              {step === 'pin' ? 'Set a parent PIN' : 'Confirm your PIN'}
            </h2>
            <p className="text-caption text-text-muted mb-5">
              {step === 'pin'
                ? 'Four digits. A parent uses this to approve payouts and change settings.'
                : 'Enter the same four digits again.'}
            </p>
            <PinPad onSubmit={onPin} shake={shake > 0 && step === 'pin'} />
            {pinError && <p className="mt-3 text-caption text-rust text-center">{pinError}</p>}
          </Card>
        )}

        {step === 'key' && (
          <Card>
            <div className="flex items-center gap-2 mb-2 text-gold">
              <KeyRound size={18} />
              <span className="text-micro uppercase tracking-wider font-semibold">AI Coach (optional)</span>
            </div>
            <h2 className="font-display text-h1 font-semibold text-text mb-2">Real AI feedback?</h2>
            <p className="text-caption text-text-muted mb-4 leading-relaxed">
              With a free Google Gemini API key, a real AI coach reads each piece and judges it like a writing
              teacher would. Without one, we use a local scorer — still useful, less nuanced.
            </p>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-caption text-gold hover:text-gold-bright underline underline-offset-2 mb-4"
            >
              Get a free key at aistudio.google.com <ExternalLink size={12} />
            </a>
            <Input
              type="password"
              placeholder="Paste API key (or leave blank)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-micro text-text-faint mt-2 leading-snug">
              Your key stays on this device and is only sent to Google's Gemini API.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="ghost" onClick={() => go('cap')} className="flex-1">Skip</Button>
              <Button variant="gold" onClick={() => go('cap')} className="flex-[2]">
                Continue <ArrowRight size={16} />
              </Button>
            </div>
          </Card>
        )}

        {step === 'cap' && (
          <Card>
            <div className="flex items-center gap-2 mb-2 text-gold">
              <Coins size={18} />
              <span className="text-micro uppercase tracking-wider font-semibold">Daily Cap</span>
            </div>
            <h2 className="font-display text-h1 font-semibold text-text mb-2">How much per day?</h2>
            <p className="text-caption text-text-muted mb-5 leading-relaxed">
              Max earnings per day. Pieces over this still count for practice — just no extra payout.
            </p>
            <div className="text-center mb-3 font-mono text-display font-semibold text-gold tabular-nums">
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
            <Button variant="gold" fullWidth onClick={finish} className="mt-6">
              <Check size={16} /> Start writing
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-white/8 rounded-2xl p-6 shadow-card animate-slide-up">
      {children}
    </div>
  );
}
