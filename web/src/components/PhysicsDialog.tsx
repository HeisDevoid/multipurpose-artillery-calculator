import { useEffect } from 'react'

import { t } from '../i18n'
import { setFeature, useFeature } from '../lib/features'
import { markPhysicsAsked, physicsAsked, setPanel, tourDone, usePanel } from '../lib/uiPanels'
import { AceMenuDemo } from './AceTableDemo'
import { FieldIcon } from './FieldIcon'

/**
 * The main question before firing: does the server have shell flight physics
 * (air resistance, ACE advanced ballistics). All tables depend on the
 * answer. It opens by itself on the first start (before the tutorial), later from
 * the help and the settings.
 */
export function PhysicsDialog() {
  const open = usePanel('physics')
  const physics = useFeature('weather')

  // Not asked yet: before the tutorial
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
      <div className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl sm:p-6">
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

        <p className="mt-4 text-[14px] leading-relaxed text-app-text">{t('physics.how')}</p>

        {/* As in the game: Ctrl+Win, the item with the weapon name without and with an asterisk, the table */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Variant withAir={false} onPick={() => answer(false)} />
          <Variant withAir onPick={() => answer(true)} />
        </div>

        {/* Without ACE there is no table, and artillery in plain Arma 3 has no air resistance */}
        <p className="mt-3 text-[13px] leading-relaxed text-app-text-2">{t('physics.no-ace')}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-app-line pt-3 text-[12.5px] text-app-muted">
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

// Close; on the first start the tutorial follows the answer
function closePhysics() {
  setPanel('physics', false)
  if (!tourDone()) window.setTimeout(() => setPanel('tour', true), 400)
}

/** An answer variant: how it looks in the game, what it means and a "mine looks like this" button. */
function Variant({ withAir, onPick }: { withAir: boolean; onPick: () => void }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg ring-1 ring-app-line">
      <AceMenuDemo withAir={withAir} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className={`text-[15px] font-semibold ${withAir ? 'text-ok' : 'text-app-text'}`}>
          {withAir ? t('physics.with') : t('physics.without')}
        </p>
        <p className="text-[13px] leading-snug text-app-muted">
          {withAir ? t('physics.with-note') : t('physics.without-note')}
        </p>
        <div className="mt-auto pt-2">
          <button type="button" onClick={onPick} className="btn h-auto w-full min-w-0 py-2 whitespace-normal">
            {withAir ? t('physics.yes') : t('physics.no')}
          </button>
        </div>
      </div>
    </div>
  )
}
