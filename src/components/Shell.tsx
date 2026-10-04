import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Award, BookMarked, BookOpen, ChevronLeft, Home as HomeIcon, Library, Settings as SettingsIcon, Wallet } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { EarningsPill } from './EarningsPill';
import { ToastHost } from './ui/Toast';
import type { Screen } from '../types';
import { CloudStatusBadge } from './CloudStatusBadge';

const HIDE_NAV_ON: Screen[] = ['onboarding', 'write', 'result', 'parent-gate'];

export function Shell({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const showBack = state.navStack.length > 0 && state.screen !== 'onboarding';
  const hideNav = HIDE_NAV_ON.includes(state.screen);
  const [clockMs, setClockMs] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const firstCheck = window.setTimeout(() => setClockMs(Date.now()), 0);
    const interval = window.setInterval(() => setClockMs(Date.now()), 30_000);
    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
    };
  }, []);

  const isParent = clockMs > 0 && state.parentUnlockedUntil > clockMs;
  const readableScreen = ['write', 'result', 'journal', 'craft-library', 'parent-dashboard', 'settings'].includes(state.screen);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active?.getAttribute('contenteditable') === 'true') return;
    mainRef.current?.focus({ preventScroll: true });
  }, [state.screen]);

  const mainClass = readableScreen ? 'atlas-main atlas-main-reading' : 'atlas-main';

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="atlas-header">
        <div className={`atlas-header-inner ${showBack ? 'has-back' : ''}`}>
          <div className="flex items-center gap-2 min-w-0">
            {showBack && (
              <button onClick={() => dispatch({ type: 'NAV_BACK' })} className="atlas-back-button" aria-label="Back">
                <ChevronLeft size={20} aria-hidden="true" />
                <span className="text-caption hidden sm:inline">Back</span>
              </button>
            )}
            <div className="atlas-brand">
              <span className="atlas-brand-mark" aria-hidden="true"><BookOpen size={19} /></span>
              <span className="atlas-brand-copy">
                <span className="atlas-brand-title">Writer&apos;s Studio</span>
                <span className="atlas-brand-subtitle">your story atlas</span>
              </span>
              {isParent && <span className="text-caption font-sans text-gold-deep">· parent</span>}
            </div>
          </div>
          <div className="atlas-header-actions">
            <CloudStatusBadge />
            <EarningsPill />
          </div>
        </div>
      </header>

      <main ref={mainRef} id="main-content" tabIndex={-1} className={`flex-1 ${mainClass} animate-fade-in`}>
        {children}
      </main>

      {!hideNav && (
        <nav className="atlas-nav" aria-label="Main navigation">
          <div className="atlas-nav-inner">
            <NavItem
              icon={<HomeIcon size={20} />}
              label="Home"
              active={state.screen === 'home'}
              onClick={() => dispatch({ type: 'NAV_RESET', screen: 'home' })}
            />
            <NavItem
              icon={<Library size={20} />}
              label="Craft"
              active={state.screen === 'craft-library'}
              onClick={() => dispatch({ type: 'NAV', screen: 'craft-library' })}
            />
            <NavItem
              icon={<Wallet size={20} />}
              label="Wallet"
              active={state.screen === 'wallet'}
              onClick={() => dispatch({ type: 'NAV', screen: 'wallet' })}
            />
            <NavItem
              icon={<BookMarked size={20} />}
              label="Journal"
              active={state.screen === 'journal'}
              onClick={() => dispatch({ type: 'NAV', screen: 'journal' })}
            />
            <NavItem
              icon={isParent ? <SettingsIcon size={20} /> : <Award size={20} />}
              label={isParent ? 'Parent' : 'Badges'}
              active={state.screen === 'badges' || state.screen === 'parent-dashboard' || state.screen === 'settings'}
              onClick={() => {
                if (isParent) dispatch({ type: 'NAV', screen: 'parent-dashboard' });
                else dispatch({ type: 'NAV', screen: 'badges' });
              }}
            />
          </div>
        </nav>
      )}

      <ToastHost />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`atlas-nav-item ${active ? 'is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      <span className="atlas-nav-label">{label}</span>
    </button>
  );
}
