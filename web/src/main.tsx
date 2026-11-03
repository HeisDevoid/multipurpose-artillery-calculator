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

// Работа без интернета (PWA). В режиме разработки не нужна — мешала бы
// горячей перезагрузке.
// В программе для ПК файлы и так локальные — service worker не нужен.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isDesktop) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${__APP_VERSION__}`)
      .catch(() => {
        // Без service worker приложение просто работает только онлайн.
      })
  })
}

// Свои звуки — из IndexedDB; звук подаёт основное окно
if (!isOverlayWindow) void loadCustomSounds()

// Окно-оверлей прозрачное: фон страницы не закрашиваем.
// Поверх игры — всегда тёмная тема, независимо от настроек основного окна.
if (isOverlayWindow) document.documentElement.classList.add('overlay', 'dark')

// Тема — до первой отрисовки: без мигания светлым и на экране ошибки тоже
try {
  document.documentElement.classList.toggle('dark', localStorage.getItem('theme') !== 'light')
} catch {
  document.documentElement.classList.add('dark')
}

applyMotion()
installGlobalErrorLog()

// До первой отрисовки: словарь языка (русский и английский уже в основном
// файле; не загрузился — интерфейс по-английски) и таблицы выбранного орудия
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

// Остальные таблицы — в фоне, когда браузер свободен: потом орудие
// меняется мгновенно, а сайт работает без интернета
if (!isOverlayWindow) {
  const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 2000))
  idle(() => void preloadAllTables())
}
