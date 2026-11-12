import { applyMotion } from './lib/motion'
import { installGlobalErrorLog } from './lib/errorLog'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OverlayApp } from './components/OverlayApp.tsx'
import { SyncProvider } from './components/SyncProvider.tsx'
import { isDesktop, isOverlayWindow } from './lib/desktop.ts'
import { loadLanguage } from './i18n'
import { initialModelId, loadTables, preloadAllTables } from './data/artillery/tables.ts'
import { initialLanguage } from './lib/seo.ts'
import { loadCustomSounds } from './lib/sound.ts'
import { startUsageCounter } from './lib/usage.ts'

// Offline work (PWA). Not needed in development: it would get in the way of
// hot reload.
// In the Windows app the files are local anyway: no service worker is needed.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isDesktop) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${__APP_VERSION__}`)
      .catch(() => {
        // Without a service worker the app simply works online only.
      })
  })
}

// Own sounds come from IndexedDB; the main window plays the sound
if (!isOverlayWindow) void loadCustomSounds()

// The overlay window is transparent: the page background is not painted.
// Over the game the theme is always dark, whatever the main window settings are.
if (isOverlayWindow) document.documentElement.classList.add('overlay', 'dark')

// The theme before the first render: no flash of light, on the error screen too
try {
  document.documentElement.classList.toggle('dark', localStorage.getItem('theme') !== 'light')
} catch {
  document.documentElement.classList.add('dark')
}

applyMotion()
installGlobalErrorLog()

// Before the first render: the language dictionary (Russian and English are in the main
// file; if it fails to load, the interface is in English) and the tables of the selected weapon
await Promise.all([
  loadLanguage(initialLanguage()).catch(() => undefined),
  isOverlayWindow ? undefined : loadTables(initialModelId()).catch(() => undefined),
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary area={isOverlayWindow ? 'overlay' : 'app'}>
      {isOverlayWindow ? (
        <OverlayApp />
      ) : (
        <SyncProvider>
          <App />
        </SyncProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)

// The other tables load in the background when the browser is idle: then the weapon
// changes instantly, and the site works offline
if (!isOverlayWindow) {
  const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 2000))
  idle(() => void preloadAllTables())
}

// Anonymous usage counter: one request a day, off in the settings
startUsageCounter()
