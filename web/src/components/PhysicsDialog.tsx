import { useEffect } from 'react'

import { t } from '../i18n'
import { setFeature, useFeature } from '../lib/features'
import { markPhysicsAsked, physicsAsked, setPanel, tourDone, usePanel } from '../lib/uiPanels'
import { AceMenuDemo, AsteriskDemo } from './AceTableDemo'
import { FieldIcon } from './FieldIcon'

/**
 * Главный вопрос перед стрельбой: есть ли на сервере физика полёта снаряда
 * (сопротивление воздуха, улучшенная баллистика ACE). От ответа зависят все
 * таблицы. Открывается сам при первом запуске (до обучения), потом — из
 * справки и настроек.
 */
export function PhysicsDialog() {
  const open = usePanel('physics')
  const physics = useFeature('weather')

  // Ещё не спрашивали — до обучения
  useEffect(() => {
    if (physicsAsked()) return
    const timer = window.setTimeout(() => setPanel('physics', true), 500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closePhysics()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  function answer(on: boolean) {
    setFeature('weather', on)
    markPhysicsAsked()
    closePhysics()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="physics-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
    >
      <div className="panel max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warn/15 text-warn">
            <FieldIcon name="warning" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="physics-title" className="text-[18px] leading-snug font-semibold text-app-text">
              {t('physics.title')}
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-app-text-2">{t('physics.why')}</p>
          </div>
        </div>

        <p className="label mt-5">{t('physics.how')}</p>
        <ol className="mt-2 space-y-2 text-[14px] leading-relaxed text-app-text-2">
          <li className="flex gap-2.5">
            <b className="w-4 shrink-0 text-app-text">1</b>
            {t('physics.step1')}
          </li>
        </ol>

        {/* Как в игре: меню ACE на себя, пункт с названием орудия, таблица */}
        <div className="mt-3 overflow-hidden rounded-lg ring-1 ring-app-line-strong">
          <AceMenuDemo />
        </div>

        <ol start={2} className="mt-4 space-y-2 text-[14px] leading-relaxed text-app-text-2">
          <li className="flex gap-2.5">
            <b className="w-4 shrink-0 text-app-text">2</b>
            {t('physics.step2')}
          </li>
          <li className="flex gap-2.5">
            <b className="w-4 shrink-0 text-app-text">3</b>
            {t('physics.step3')}
          </li>
        </ol>

        {/* Пункт меню со звёздочкой и без, и что тогда в таблице */}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <AsteriskSample withAir={false} />
          <AsteriskSample withAir />
        </div>

        {/* Без ACE таблицы нет, а у артиллерии в обычной Arma 3 сопротивления воздуха нет */}
        <p className="mt-3 rounded-md bg-app-raised px-3 py-2 text-[13px] leading-relaxed text-app-text-2">
          {t('physics.no-ace')}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => answer(true)} className="btn btn-primary h-auto min-w-0 py-2 whitespace-normal">
            {t('physics.yes')}
          </button>
          <button type="button" onClick={() => answer(false)} className="btn h-auto min-w-0 py-2 whitespace-normal">
            {t('physics.no')}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-app-muted">
          <span>
            {physics ? t('physics.now-on') : t('physics.now-off')} {t('physics.settings-note')}
          </span>
          <button type="button" onClick={closePhysics} className="btn btn-ghost btn-sm">
            {t('physics.later')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Закрыть; при первом запуске после ответа — обучение
function closePhysics() {
  setPanel('physics', false)
  if (!tourDone()) window.setTimeout(() => setPanel('tour', true), 400)
}

/** Пункт меню ACE со звёздочкой или без и таблица за ним: так видно разницу. */
function AsteriskSample({ withAir }: { withAir: boolean }) {
  return (
    <div className="rounded-lg bg-app-raised p-2.5">
      <p className={`mb-2 text-[12px] font-semibold ${withAir ? 'text-ok' : 'text-app-muted'}`}>
        {withAir ? t('physics.with') : t('physics.without')}
      </p>
      <div className="overflow-hidden rounded-md">
        <AsteriskDemo withAir={withAir} />
      </div>
    </div>
  )
}
