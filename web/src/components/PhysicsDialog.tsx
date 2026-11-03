import { useEffect } from 'react'

import { t } from '../i18n'
import { setFeature, useFeature } from '../lib/features'
import { markPhysicsAsked, physicsAsked, setPanel, tourDone, usePanel } from '../lib/uiPanels'
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
          <li className="flex gap-2.5">
            <b className="w-4 shrink-0 text-app-text">2</b>
            {t('physics.step2')}
          </li>
          <li className="flex gap-2.5">
            <b className="w-4 shrink-0 text-app-text">3</b>
            {t('physics.step3')}
          </li>
        </ol>

        {/* Без ACE листа нет, а у артиллерии в обычной Arma 3 сопротивления воздуха нет */}
        <p className="mt-3 rounded-md bg-app-raised px-3 py-2 text-[13px] leading-relaxed text-app-text-2">
          {t('physics.no-ace')}
        </p>

        {/* Как это выглядит на листе: со звёздочкой и с поправками / без */}
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <SheetSample withPhysics />
          <SheetSample withPhysics={false} />
        </div>

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

/** Шапка листа таблицы стрельбы и одна строка: так видно разницу. */
function SheetSample({ withPhysics }: { withPhysics: boolean }) {
  const cells = withPhysics ? ['0.4', '-6.2', '5.7', '-1.1'] : ['-', '-', '-', '-']
  return (
    <div className="rounded-lg bg-app-raised p-3">
      <p className={`text-[12px] font-semibold ${withPhysics ? 'text-ok' : 'text-app-muted'}`}>
        {withPhysics ? t('physics.with') : t('physics.without')}
      </p>
      <div className="mt-2 rounded-md bg-[#ece6d6] px-2.5 py-2 font-mono text-[12px] leading-snug text-[#2b2a26]">
        <p className="font-semibold">
          M252 81mm Mortar
          {withPhysics && (
            <span className="ml-0.5 rounded-sm bg-warn/70 px-0.5 text-[13px] text-black">*</span>
          )}
        </p>
        <p className="mt-1 flex gap-2 tabular-nums">
          <span>1000</span>
          <span>1333</span>
          {cells.map((cell, index) => (
            <span key={index} className={withPhysics ? 'font-semibold' : 'opacity-60'}>
              {cell}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
