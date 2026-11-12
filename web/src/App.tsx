import { loadLanguage, setLanguage as setI18nLanguage, t } from './i18n'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

import { Footer, type View } from './components/Footer'
import { GunnerAwayBanner } from './components/GunnerAwayBanner'
import { HelpDialog } from './components/HelpDialog'
import { PhysicsDialog } from './components/PhysicsDialog'
import { UpdateBanner } from './components/UpdateBanner'
import { HotkeysDialog } from './components/HotkeysDialog'
import { Tour } from './components/Tour'
import { DashboardPage } from './pages/DashboardPage'

import { isAvailableModel } from './data/artillery/tables'
import type { ModelId } from './data/models'
import { onHotkey, toggleOverlay } from './lib/desktop'
import { DEV_BUILD } from './lib/devBuild'
import { applyHead, initialLanguage } from './lib/seo'
import { readInvite } from './lib/sync'
import { usePersistentState } from './lib/usePersistentState'
import { useWakeLock } from './lib/useWakeLock'
import { CrashProbe } from './components/ErrorBoundary'
import type { Language, Theme } from './types/settings'

// Link and the settings load on demand: the main screen
// opens faster, especially on a phone.
const SyncPage = lazy(() =>
  import('./pages/SyncPage').then((m) => ({ default: m.SyncPage }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

// The default language is the system one
const parseFlag = (fallback: boolean) => (raw: string | null) =>
  raw === null ? fallback : raw === 'true'

/** A secondary screen: Back and a title. */
function SubView({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={onBack} className="btn btn-ghost -ml-3">
          <span aria-hidden="true">←</span>
          {t('app.back')}
        </button>
        <h1 className="text-2xl font-semibold text-app-text">{title}</h1>
      </div>
      {children}
    </div>
  )
}

function App() {
  const [selectedModel, setSelectedModel] = usePersistentState<ModelId>(
    'selectedModel',
    (raw) => (raw && isAvailableModel(raw) ? raw : 'mk6')
  )

  // A gunner's invitation link opens Link at once
  const [view, setView] = useState<View>(() =>
    readInvite(window.location.search) ? 'sync' : 'dashboard'
  )

  // The language: from the address (?lang=), else the one chosen earlier, else the system one
  const [language, setLanguage] = usePersistentState<Language>('language', initialLanguage)
  // The language for t(): set before the child components render
  setI18nLanguage(language)
  const [theme, setTheme] = usePersistentState<Theme>('theme', (raw) =>
    raw === 'light' ? 'light' : 'dark'
  )
  // Keep the screen on (a phone at the gun)
  const [keepAwake, setKeepAwake] = usePersistentState(
    'keepAwake',
    parseFlag(false)
  )
  // Experimental input by grid coordinates
  const [gridInput, setGridInput] = usePersistentState(
    'experimentalGrid',
    parseFlag(false)
  )
  // The map with markers and heights
  const [mapInput, setMapInput] = usePersistentState('showMap', parseFlag(true))

  // Map markers and markers from the game screen are optional, in the settings
  const [showMarkers, setShowMarkers] = usePersistentState(
    'showMarkers',
    parseFlag(false)
  )
  const [showScreenMarkers, setShowScreenMarkers] = usePersistentState(
    'showScreenMarkers',
    parseFlag(false)
  )

  useWakeLock(keepAwake)

  // Windows app: Ctrl+Alt+O shows and hides the overlay
  useEffect(
    () =>
      onHotkey((action) => {
        if (action === 'overlay') void toggleOverlay()
      }),
    []
  )

  useEffect(() => applyHead(language), [language])

  // Changing the language: the dictionary first (it loads on demand), then
  // the interface; ?lang= in the address changes too, so the old language does not come back
  function changeLanguage(next: Language) {
    void loadLanguage(next).then(() => {
      const url = new URL(window.location.href)
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', next)
        window.history.replaceState(window.history.state, '', url)
      }
      setLanguage(next)
    })
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
  }, [theme])

  const back = () => setView('dashboard')

  // Changing the theme: a circle spreads from the button; without browser support it is instant
  function toggleTheme(origin: { x: number; y: number }) {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const doc = document as Document & {
      startViewTransition?: (update: () => void) => { ready: Promise<void> }
    }
    // The theme circle is built in and always works where the browser can do it
    if (!doc.startViewTransition) {
      setTheme(next)
      return
    }
    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y)
    )
    const transition = doc.startViewTransition(() => {
      document.documentElement.classList.toggle('dark', next === 'dark')
      flushSync(() => setTheme(next))
    })
    void transition.ready.then(() =>
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: 650,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      )
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <CrashProbe area="app" />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-6 pb-4 sm:px-6 lg:pt-14">
        {/* The gunner left the Link page: the settings are not updated */}
        {view !== 'sync' && <GunnerAwayBanner onBack={() => setView('sync')} />}

        {/* The page title for search and screen readers */}
        {view === 'dashboard' && <h1 className="sr-only">{t('seo.heading')}</h1>}
        {view === 'dashboard' && (
          <DashboardPage
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            language={language}
            gridInput={DEV_BUILD && gridInput}
            mapInput={mapInput}
            showMarkers={showMarkers}
            showScreenMarkers={DEV_BUILD && showScreenMarkers}
          />
        )}

        <Suspense
          fallback={
            <p className="label py-16 text-center">
              {t('app.loading')}
            </p>
          }
        >
          {view === 'sync' && (
            <SubView
              title={t('app.fdc-gunner-link')}
              onBack={back}
            >
              <SyncPage language={language} />
            </SubView>
          )}

          {view === 'settings' && (
            <SubView
              title={t('app.settings')}
              onBack={back}
            >
              <SettingsPage
                gridInput={gridInput}
                onGridInputChange={setGridInput}
                mapInput={mapInput}
                onMapInputChange={setMapInput}
                showMarkers={showMarkers}
                onShowMarkersChange={setShowMarkers}
                showScreenMarkers={showScreenMarkers}
                onShowScreenMarkersChange={setShowScreenMarkers}
                keepAwake={keepAwake}
                onKeepAwakeChange={setKeepAwake}
              />
            </SubView>
          )}
        </Suspense>
      </main>

      <HotkeysDialog />
      <HelpDialog />
      <PhysicsDialog />
      <UpdateBanner />
      {view === 'dashboard' && <Tour />}

      <Footer
        view={view}
        onViewChange={setView}
        language={language}
        onLanguageChange={changeLanguage}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  )
}

export default App
