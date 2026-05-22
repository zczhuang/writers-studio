import { useEffect } from 'react';
import { useApp } from './state/AppContext';
import { Shell } from './components/Shell';
import { HomeScreen } from './screens/HomeScreen';
import { ModeListScreen } from './screens/ModeListScreen';
import { WriteScreen } from './screens/WriteScreen';
import { ResultScreen } from './screens/ResultScreen';
import { WalletScreen } from './screens/WalletScreen';
import { JournalScreen } from './screens/JournalScreen';
import { BadgesScreen } from './screens/BadgesScreen';
import { ParentGateScreen } from './screens/ParentGateScreen';
import { ParentDashboardScreen } from './screens/ParentDashboardScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { BADGES } from './data/badges';
import { pushToast } from './hooks/useToast';

export function App() {
  const { state, dispatch } = useApp();

  // Re-check achievements after any meaningful state change
  useEffect(() => {
    const have = new Set(state.writer.achievements.map((a) => a.id));
    const newlyEarned = BADGES.filter((b) => !have.has(b.id) && b.check(state)).map((b) => b.id);
    if (newlyEarned.length > 0) {
      dispatch({ type: 'UNLOCK_ACHIEVEMENTS', ids: newlyEarned });
      const def = BADGES.find((b) => b.id === newlyEarned[0]);
      if (def) pushToast(`Achievement: ${def.name}`, 'success');
    }
  }, [state.writer.totalChallenges, state.writer.totalWords, state.writer.streak, state.entries.length, state.earnings.lifetimePaid, state.writer.modesPlayed.length, dispatch]);

  // Onboarding takes over the screen with no shell
  if (state.screen === 'onboarding') return <OnboardingScreen />;

  return (
    <Shell>
      <ScreenRouter />
    </Shell>
  );
}

function ScreenRouter() {
  const { state } = useApp();
  switch (state.screen) {
    case 'home': return <HomeScreen />;
    case 'mode-list': return <ModeListScreen />;
    case 'write': return <WriteScreen />;
    case 'result': return <ResultScreen />;
    case 'wallet': return <WalletScreen />;
    case 'journal': return <JournalScreen />;
    case 'badges': return <BadgesScreen />;
    case 'parent-gate': return <ParentGateScreen />;
    case 'parent-dashboard': return <ParentDashboardScreen />;
    case 'settings': return <SettingsScreen />;
    default: return <HomeScreen />;
  }
}
