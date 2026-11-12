import { useEffect, useState } from 'react'

import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'

/**
 * A divider line with a clear button on the right. It works on the second
 * press (the first asks to confirm and resets after 3 s), so that the
 * entered values are not erased by accident.
 */
export function ConfirmClear({
  label,
  onConfirm,
  disabled = false,
}: {
  label: string
  onConfirm: () => void
  disabled?: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 3000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  return (
    <div className="my-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-app-border" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (confirming) {
            setConfirming(false)
            onConfirm()
          } else {
            setConfirming(true)
          }
        }}
        className={[
          'btn btn-sm',
          confirming ? 'btn-danger' : 'btn-ghost text-app-muted',
        ].join(' ')}
      >
        <FieldIcon name="trash" className="h-4 w-4" />
        {confirming ? t('artilleryCalculator.tap-again-to-clear') : label}
      </button>
    </div>
  )
}
