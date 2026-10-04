import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Award, BookMarked, ChevronLeft, Home as HomeIcon, Library, PenLine, Settings as SettingsIcon, ShieldCheck, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { EarningsPill } from './EarningsPill';
import { ToastHost } from './ui/Toast';
import type { Screen } from '../types';
import { CloudStatusBadge } from './CloudStatusBadge';
import { BrandMark } from './art/BrandMark';
import { StarField } from './art/StarField';
import { ProgressRing } from './art/ProgressRing';
import { rankSnapshot, recommendedChallenge } from '../utils/progression';
import { LEVEL_ICONS } from './journey/levelIcons';
import { toneVars } from '../data/tones';

const HIDE_NAV_ON: Screen[] = ['onboarding', 'write', 'result', 'parent-gate'];
const READING_SCREENS: Screen[] = ['write', 'result', 'journal', 'parent-dashboard', 'settings'];

interface NavDef {
  id: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}

export function Shell({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const showBack = state.navStack.length > 0 && state.screen !== 'onboarding';
  const focusMode = HIDE_NAV_ON.includes(state.screen);
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active?.getAttribute('contenteditable') === 'true') return;
    mainRef.current?.focus({ preventScroll: true });
  }, [state.screen]);

  const go = (screen: Screen) => dispatch({ type: 'NAV', screen });
  const openParent = () => {
    if (isParent) go('parent-dashboard');
    else dispatch({ type: 'REQUEST_PARENT_GATE', target: 'parent-dashboard' });
  };
  const startWriting = () => {
    const recommendation = recommendedChallenge(state.entries, state.memory);
    dispatch({ type: 'PICK_MODE', mode: recommendation.mode });
    dispatch({ type: 'PICK_CHALLENGE', challengeId: recommendation.challenge.id });
    dispatch({ type: 'NAV', screen: 'write' });
  };

  const home: NavDef = { id: 'home', label: 'Home', Icon: HomeIcon, active: state.screen === 'home' || state.screen === 'mode-list', onClick: () => dispatch({ type: 'NAV_RESET', screen: 'home' }) };
  const craft: NavDef = { id: 'craft', label: 'Craft', Icon: Library, active: state.screen === 'craft-library', onClick: () => go('craft-library') };
  const journal: NavDef = { id: 'journal', label: 'Journal', Icon: BookMarked, active: state.screen === 'journal', onClick: () => go('journal') };
  const badges: NavDef = { id: 'badges', label: 'Badges', Icon: Award, active: state.screen === 'badges', onClick: () => go('badges') };
  const wallet: NavDef = { id: 'wallet', label: 'Wallet', Icon: Wallet, active: state.screen === 'wallet', onClick: () => go('wallet') };
  const parent: NavDef = { id: 'parent', label: 'Parent', Icon: SettingsIcon, active: state.screen === 'parent-dashboard' || state.screen === 'settings', onClick: openParent };

  // The dock has five slots; in parent mode the Parent tab replaces Badges.
  const dockItems = [home, craft, wallet, journal, isParent ? parent : badges];
  const sideItems = [home, craft, journal, badges, wallet];

  const rank = rankSnapshot(state.writer.xp);
  const RankIcon = LEVEL_ICONS[rank.level.icon] ?? PenLine;
  const mainClass = ['ws-main', READING_SCREENS.includes(state.screen) ? 'is-reading' : '', focusMode ? 'is-focus' : ''].filter(Boolean).join(' ');

  return (
    <div className="ws-app">
      <div className="ws-backdrop" aria-hidden="true" />

      {!focusMode && (
        <aside className="ws-sidebar" aria-label="Writer's Studio">
          <StarField seed={11} count={34} sparkles={3} sparkleFrom={72} />
          <button type="button" className="ws-brand" onClick={home.onClick} aria-label="Writer's Studio home">
            <BrandMark />
            <span className="ws-brand-copy">
              <span className="ws-brand-title">Writer&apos;s Studio</span>
              <span className="ws-brand-sub">Story atlas</span>
            </span>
          </button>

          <button type="button" className="ws-btn ws-btn--gold ws-btn--block ws-side-cta" onClick={startWriting}>
            <PenLine size={18} aria-hidden="true" /> Write a new page
          </button>

          <nav className="ws-side-nav" aria-label="Main navigation">
            {sideItems.map((item) => <SideLink key={item.id} item={item} />)}
            <p className="ws-side-label">For grown-ups</p>
            <SideLink item={{ ...parent, label: isParent ? 'Parent dashboard' : 'Parent area', Icon: isParent ? SettingsIcon : ShieldCheck }} />
          </nav>

          <div className="ws-side-foot">
            <div className="ws-side-rank" style={toneVars('gold')}>
              <ProgressRing pct={rank.pct} size={46} stroke={5} label={`${rank.level.name} rank, ${Math.round(rank.pct)} percent`}>
                <RankIcon size={18} aria-hidden="true" />
              </ProgressRing>
              <div className="min-w-0">
                <strong>{rank.level.name}</strong>
                <span>{rank.nextLevel ? `${rank.xpToNext} XP to ${rank.nextLevel.name}` : 'Final rank reached'}</span>
              </div>
            </div>
            <div className="ws-side-status">
              <CloudStatusBadge />
              <EarningsPill />
            </div>
          </div>
        </aside>
      )}

      <div className={`ws-column ${focusMode ? '' : 'has-sidebar'}`}>
        <header className={`ws-topbar ${showBack ? 'has-back' : ''}`}>
          <div className="ws-topbar-inner">
            {showBack && (
              <button type="button" onClick={() => dispatch({ type: 'NAV_BACK' })} className="ws-back" aria-label="Back">
                <ChevronLeft size={20} aria-hidden="true" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            {focusMode ? (
              <span className="ws-brand">
                <BrandMark />
                <span className="ws-brand-copy">
                  <span className="ws-brand-title">Writer&apos;s Studio</span>
                  <span className="ws-brand-sub">{isParent ? 'Parent mode' : 'Story atlas'}</span>
                </span>
              </span>
            ) : (
              <button type="button" className="ws-brand" onClick={home.onClick} aria-label="Writer's Studio home">
                <BrandMark />
                <span className="ws-brand-copy">
                  <span className="ws-brand-title">Writer&apos;s Studio</span>
                  <span className="ws-brand-sub">{isParent ? 'Parent mode' : 'Story atlas'}</span>
                </span>
              </button>
            )}
            <span className="ws-topbar-spacer" />
            <div className="ws-topbar-actions">
              {/* Always reachable, even with nothing to pay out, so a parent can open recovery on a fresh device. */}
              {!focusMode && (
                <button
                  type="button"
                  onClick={openParent}
                  className={`ws-pill ws-parent-chip ${parent.active ? 'is-active' : ''}`}
                  aria-label={isParent ? 'Open parent dashboard' : 'Unlock parent mode'}
                  aria-current={state.screen === 'parent-dashboard' ? 'page' : undefined}
                >
                  <ShieldCheck size={15} aria-hidden="true" />
                  <span className="ws-parent-label">Parent</span>
                </button>
              )}
              <CloudStatusBadge />
              <EarningsPill />
            </div>
          </div>
        </header>

        <main ref={mainRef} id="main-content" tabIndex={-1} className={mainClass}>
          {children}
        </main>
      </div>

      {!focusMode && (
        <nav className="ws-dock" aria-label="Main navigation">
          {dockItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`ws-dock-item ${item.active ? 'is-active' : ''}`}
              aria-current={item.active ? 'page' : undefined}
            >
              <item.Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      <ToastHost />
    </div>
  );
}

function SideLink({ item }: { item: NavDef }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      className={`ws-side-link ${item.active ? 'is-active' : ''}`}
      aria-current={item.active ? 'page' : undefined}
    >
      <span className="ws-side-icon"><item.Icon size={18} aria-hidden="true" /></span>
      <span>{item.label}</span>
    </button>
  );
}
