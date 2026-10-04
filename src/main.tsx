import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted, OFL-licensed variable fonts: no third-party font requests and they keep working offline.
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/standard-italic.css';
import '@fontsource-variable/figtree/index.css';
import '@fontsource-variable/literata/wght.css';
import '@fontsource-variable/literata/wght-italic.css';
import './index.css';
import { App } from './App.tsx';
import { AppProvider } from './state/AppContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);
