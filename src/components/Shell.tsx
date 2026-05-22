import type { ReactNode } from 'react';
import { ChevronLeft, Wallet, BookMarked, Award, Settings as SettingsIcon, Home as HomeIcon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { EarningsPill } from './EarningsPill';
import { ToastHost } from './ui/Toast';
import type { Screen } from '../types';

const HIDE_NAV_ON: Screen[] = ['onboarding', 'write', 'result', 'parent-gate'];

export function Shell({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const showBack = state.navStack.length > 0 && state.screen !== 'onboarding';
  const hideNav = HIDE_NAV_ON.includes(state.screen);

  const isParent = state.parentUnlockedUntil > Date.now();

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="sticky top-0 z-40 bg-bg border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {showBack ? (
              <button
                onClick={() => dispatch({ type: 'NAV_BACK' })}
                className="flex items-center gap-1 text-text-muted hover:text-text transition-colors -ml-1 px-1.5 py-1 rounded"
                aria-label="Back"
              >
                <ChevronLeft size={20} />
                <span className="text-caption hidden sm:inline">Back</span>
              </button>
            ) : (
              <span className="font-display text-h2 font-semibold tracking-tight text-text">
                Writer's Studio
                {isParent && <span className="ml-2 text-caption font-sans text-gold/90">· parent</span>}
              </span>
            )}
          </div>
          <EarningsPill />
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 pb-32 animate-fade-in">
        {children}
      </main>

      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-sm border-t border-white/5">
          <div className="max-w-2xl mx-auto px-2 grid grid-cols-4 gap-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <NavItem
              icon={<HomeIcon size={20} />}
              label="Home"
              active={state.screen === 'home'}
              onClick={() => dispatch({ type: 'NAV_RESET', screen: 'home' })}
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
      className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
        active ? 'text-gold' : 'text-text-faint hover:text-text-muted'
      }`}
    >
      {icon}
      <span className="text-micro font-medium uppercase tracking-wide">{label}</span>
    </button>
  );
}
