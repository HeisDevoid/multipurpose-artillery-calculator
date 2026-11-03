import type { ReactNode } from 'react'

import { t } from '../../i18n'
import { toGridReference, type MapPoint } from '../../lib/heightmap'
import type { FlightShot } from '../FlightCanvas'
import { FlightTrack } from '../FlightTrack'

/**
 * Снизу на карте: координаты и высоты орудия и цели, полёт снаряда между ними,
 * под ними — зоны по рельефу (children). На телефоне орудие и цель стоят в две
 * строки, полоска полёта справа от них: так плашка не заходит на кнопку слоя
 * и не прыгает, когда полоска раскрывается.
 */
export function CoordinatePlate({
  gun,
  gunHeight,
  target,
  targetHeight,
  unit,
  flight,
  children,
}: {
  gun: MapPoint | null
  gunHeight: number | null
  target: MapPoint | null
  targetHeight: number | null
  unit: string
  flight: readonly FlightShot[]
  children?: ReactNode
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-2 flex max-w-[calc(100%-3.5rem)] flex-col rounded-lg bg-black/70 text-white/90 shadow-lg backdrop-blur-sm sm:left-1/2 sm:max-w-[calc(100%-6rem)] sm:-translate-x-1/2">
      <div className="grid grid-cols-[auto_auto] items-center gap-x-2.5 gap-y-1.5 px-2.5 py-2 text-[12px] leading-none whitespace-nowrap tabular-nums sm:flex sm:justify-center sm:gap-3 sm:px-3 sm:text-[12.5px]">
        <span className="flex items-center gap-2">
          <span className="block h-2 w-2 shrink-0 rounded-full bg-gun" />
          <span>
            {gun ? `${toGridReference(gun, 8)} · ${Math.round(gunHeight ?? 0)} ${unit}` : t('mapPicker.no-gun')}
          </span>
        </span>
        <span className="row-span-2 flex items-center sm:contents">
          <FlightTrack shots={flight} />
        </span>
        <span className="flex items-center gap-2">
          <span>
            {target
              ? `${toGridReference(target, 8)} · ${Math.round(targetHeight ?? 0)} ${unit}`
              : t('mapPicker.no-target')}
          </span>
          <span className="block h-2 w-2 shrink-0 rounded-full bg-target max-sm:order-first" />
        </span>
      </div>
      {children}
    </div>
  )
}
