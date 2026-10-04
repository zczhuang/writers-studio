import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, Check, Coins, ExternalLink, KeyRound, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PinPad } from '../components/ui/PinPad';
import { hashPin, makeSalt } from '../services/pinHash';
import { pushToast } from '../hooks/useToast';
import { HeroScene } from '../components/art/HeroScene';
import { StarField } from '../components/art/StarField';
import { BrandMark } from '../components/art/BrandMark';

type Step = 'welcome' | 'name' | 'pin' | 'pin-confirm' | 'key' | 'cap' | 'done';

const STEP_ORDER: Step[] = ['name', 'pin', 'pin-confirm', 'key', 'cap'];

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
    if (step === 'pin') { setFirstPin(pin); setPinError(''); go('pin-confirm'); return; }
    if (step === 'pin-confirm') {
      if (pin !== firstPin) {
        setPinError("Those didn't match. Choose your PIN again.");
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
    // The toast host lives in the app shell, which mounts on the next render.
    const welcomeName = name.trim() || 'Writer';
    window.setTimeout(() => pushToast(`Welcome to Writer's Studio, ${welcomeName}.`, 'success'), 150);
  };

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="ws-stage">
      <StarField seed={23} count={70} sparkles={6} sparkleFrom={2} />
      <div className="ws-stage-scene" aria-hidden="true"><HeroScene variant="landscape" /></div>

      {step === 'welcome' ? (
        <div className="ws-stage-card is-wide ws-rise text-center">
          <div className="ws-stage-logo"><BrandMark className="" /></div>
          <h1 className="ws-stage-title">Writer&apos;s Studio</h1>
          <p className="ws-stage-sub">Real writing. Real feedback. Real money for real work.</p>
          <ul className="mx-auto my-6 grid max-w-xs gap-2.5 p-0 text-left">
            {['Daily missions and four writing worlds', 'A coach that remembers how you grow', 'Rewards a parent pays out for real'].map((line) => (
              <li key={line} className="flex items-center gap-2.5 text-[0.95rem] text-ink-soft">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[rgb(var(--gold-rgb)/0.18)] text-gold-deep"><Sparkles size={13} aria-hidden="true" /></span>
                {line}
              </li>
            ))}
          </ul>
          <Button variant="gold" size="lg" fullWidth onClick={() => go('name')}>
            Begin <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="ws-stage-card is-wide ws-rise" key={step}>
          <div className="ws-steps" aria-label={`Step ${stepIndex + 1} of ${STEP_ORDER.length}`}>
            {STEP_ORDER.map((item, index) => (
              <i key={item} className={index < stepIndex ? 'is-done' : index === stepIndex ? 'is-current' : ''} />
            ))}
          </div>

          {step === 'name' && (
            <StepBody icon={<UserRound size={15} aria-hidden="true" />} kicker="About you" title="What's your name, writer?" copy="We'll use it to greet you. You can change it later.">
              <Input
                autoFocus
                label="Your name"
                placeholder="e.g. Maya"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="mt-5 grid grid-cols-[1fr_2fr] gap-2">
                <Button variant="ghost" onClick={() => { setName(''); go('pin'); }}>Skip</Button>
                <Button variant="gold" onClick={() => go('pin')}>
                  Continue <ArrowRight size={17} aria-hidden="true" />
                </Button>
              </div>
            </StepBody>
          )}

          {(step === 'pin' || step === 'pin-confirm') && (
            <StepBody
              icon={<ShieldCheck size={15} aria-hidden="true" />}
              kicker="Parent setup"
              title={step === 'pin' ? 'Set a parent PIN' : 'Confirm your PIN'}
              copy={step === 'pin'
                ? 'Four digits. A parent uses this to approve payouts and change settings.'
                : 'Enter the same four digits again.'}
            >
              {/* Keyed by step so the confirm pad starts empty instead of re-submitting the first PIN. */}
              <PinPad key={step} onSubmit={onPin} shake={shake > 0 && step === 'pin'} />
              <p className="ws-stage-error" role={pinError ? 'alert' : undefined}>{pinError}</p>
            </StepBody>
          )}

          {step === 'key' && (
            <StepBody icon={<KeyRound size={15} aria-hidden="true" />} kicker="AI coach (optional)" title="Real AI feedback?" copy="With a free Google Gemini API key, an AI coach reads each piece like a writing teacher would. Without one, a local scorer still gives useful feedback.">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-bold text-gold-deep underline underline-offset-4"
              >
                Get a free key at aistudio.google.com <ExternalLink size={13} aria-hidden="true" />
              </a>
              <Input
                type="password"
                label="Gemini API key"
                placeholder="Paste API key (or leave blank)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                hint="Your key stays on this device and is only sent to Google's Gemini API."
              />
              <div className="mt-5 grid grid-cols-[1fr_2fr] gap-2">
                <Button variant="ghost" onClick={() => go('cap')}>Skip</Button>
                <Button variant="gold" onClick={() => go('cap')}>
                  Continue <ArrowRight size={17} aria-hidden="true" />
                </Button>
              </div>
            </StepBody>
          )}

          {step === 'cap' && (
            <StepBody icon={<Coins size={15} aria-hidden="true" />} kicker="Daily cap" title="How much per day?" copy="The most a writer can earn in a day. Pieces past the cap still count for practice, just without extra payout.">
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
              <Button variant="gold" size="lg" fullWidth onClick={finish} className="mt-6">
                <Check size={18} aria-hidden="true" /> Start writing
              </Button>
            </StepBody>
          )}
        </div>
      )}
    </div>
  );
}

function StepBody({ icon, kicker, title, copy, children }: { icon: ReactNode; kicker: string; title: string; copy: string; children: ReactNode }) {
  return (
    <div>
      <div className="ws-onboard-kicker">{icon} {kicker}</div>
      <h2 className="ws-onboard-title">{title}</h2>
      <p className="ws-onboard-copy">{copy}</p>
      {children}
    </div>
  );
}
