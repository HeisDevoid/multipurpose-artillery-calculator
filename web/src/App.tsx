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

import { isModelId, type ModelId } from './data/models'
import { onHotkey, toggleOverlay } from './lib/desktop'
import { applyHead, initialLanguage } from './lib/seo'
import { readInvite } from './lib/sync'
import { usePersistentState } from './lib/usePersistentState'
import { useWakeLock } from './lib/useWakeLock'
import { CrashProbe } from './components/ErrorBoundary'
import type { Language, Theme } from './types/settings'

// Связка и настройки грузятся по требованию: главный экран
// открывается быстрее, особенно на телефоне.
const SyncPage = lazy(() =>
  import('./pages/SyncPage').then((m) => ({ default: m.SyncPage }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

// Язык по умолчанию — как у системы
const parseFlag = (fallback: boolean) => (raw: string | null) =>
  raw === null ? fallback : raw === 'true'

/** Второстепенный экран: «Назад» и заголовок. */
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
    (raw) => (raw && isModelId(raw) ? raw : 'mk6')
  )

  // По ссылке-приглашению стрелка — сразу «Связка»
  const [view, setView] = useState<View>(() =>
    readInvite(window.location.search) ? 'sync' : 'dashboard'
  )

  // Язык: из адреса (?lang=), иначе выбранный раньше, иначе как у системы
  const [language, setLanguage] = usePersistentState<Language>('language', initialLanguage)
  // Язык для t(): задаётся до отрисовки дочерних компонентов
  setI18nLanguage(language)
  const [theme, setTheme] = usePersistentState<Theme>('theme', (raw) =>
    raw === 'light' ? 'light' : 'dark'
  )
  // Не гасить экран (телефон у орудия)
  const [keepAwake, setKeepAwake] = usePersistentState(
    'keepAwake',
    parseFlag(false)
  )
  // Экспериментальный ввод по координатам сетки
  const [gridInput, setGridInput] = usePersistentState(
    'experimentalGrid',
    parseFlag(false)
  )
  // Карта с метками и высотами
  const [mapInput, setMapInput] = usePersistentState('showMap', parseFlag(true))

  // Метки на карте и метки с экрана игры — по желанию, в настройках
  const [showMarkers, setShowMarkers] = usePersistentState(
    'showMarkers',
    parseFlag(false)
  )
  const [showScreenMarkers, setShowScreenMarkers] = usePersistentState(
    'showScreenMarkers',
    parseFlag(false)
  )

  useWakeLock(keepAwake)

  // Программа для ПК: Ctrl+Alt+O показывает и скрывает оверлей
  useEffect(
    () =>
      onHotkey((action) => {
        if (action === 'overlay') void toggleOverlay()
      }),
    []
  )

  useEffect(() => applyHead(language), [language])

  // Смена языка: сначала словарь (он грузится по требованию), потом
  // интерфейс; ?lang= в адресе тоже меняется, чтобы не вернуть старый язык
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

  // Смена темы: круг расходится от кнопки; без поддержки браузера — сразу
  function toggleTheme(origin: { x: number; y: number }) {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const doc = document as Document & {
      startViewTransition?: (update: () => void) => { ready: Promise<void> }
    }
    // Круг при смене темы встроен и работает всегда, где браузер умеет
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
        {/* Стрелок ушёл со страницы «Связка»: установки не обновляются */}
        {view !== 'sync' && <GunnerAwayBanner onBack={() => setView('sync')} />}

        {/* Заголовок страницы для поиска и экранных дикторов */}
        {view === 'dashboard' && <h1 className="sr-only">{t('seo.heading')}</h1>}
        {view === 'dashboard' && (
          <DashboardPage
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            language={language}
            gridInput={gridInput}
            mapInput={mapInput}
            showMarkers={showMarkers}
            showScreenMarkers={showScreenMarkers}
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
