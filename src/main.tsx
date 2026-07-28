import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './lib/auth.tsx';
import { ensureCgopsSession } from './lib/cgopsSession';
import cgMark from './assets/cg-mark.png';
import './index.css';

// Point the browser-tab favicon at the official CG mark. Set at runtime from the
// bundled asset URL because this project has `publicDir: false`, so the artwork
// can only be referenced after Vite's asset pipeline resolves the import.
{
  const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']") ?? document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = cgMark;
  if (!link.parentNode) document.head.appendChild(link);
}

// Consume a CGOPS SSO handoff (office cohort) before anything renders, so the
// AuthProvider sees the resolved identity on mount. Chefs (no handoff) fall
// through to the normal PIN login. Runs first, before any hash-based routing.
ensureCgopsSession().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
});
