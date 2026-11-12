import { t } from '../i18n'
import { pickCharge, type ChargeResult } from '../lib/ballistics'
import { isBlocked, type Clearance } from '../lib/terrainClearance'
import type { ArtilleryMode } from '../types/artillery'
import { FieldIcon } from './FieldIcon'

export interface ChargeGroup {
  mode: ArtilleryMode
  // The trajectory label ("High") when there is more than one mode
  label: string
  results: readonly ChargeResult[]
}

interface Props {
  groups: readonly ChargeGroup[]
  activeMode: ArtilleryMode
  activeCharge: number | null
  onPick: (mode: ArtilleryMode, charge: number) => void
  // Hide the charges that do not reach the target
  hideUnfit?: boolean
  // Only the charges that are good at something: the best, the fastest, the most precise (and the chosen one)
  onlyGood?: boolean
  // Terrain on the way: where the shell hits (null: no data)
  terrainOf?: (mode: ArtilleryMode, charge: number) => Clearance | null
}

/**
 * All ways to fire at the current distance: every charge (and every
 * trajectory) as a card with elevation and time of flight. It shows at once
 * which to take and what the alternatives are: ⚡ is the fastest, ◎ is the most precise.
 */
export function ChargeStrip({
  groups,
  activeMode,
  activeCharge,
  onPick,
  hideUnfit = false,
  onlyGood = false,
  terrainOf,
}: Props) {
  const unitMil = t('unit.mil')
  const unitS = t('unit.s')

  return (
    <div className="space-y-2.5" aria-label={t('chargeStrip.ways-to-fire')}>
      {groups.map((group) => {
        const blockedAt = (charge: number) => {
          const hit = terrainOf?.(group.mode, charge) ?? null
          return isBlocked(hit) ? hit : null
        }
        // The best, fast and precise ones are among those that do not hit terrain
        const clear = group.results.filter((r) => blockedAt(r.charge) === null)
        const ranked = clear.some((r) => r.solution !== null) ? clear : group.results
        const fastestCharge = pickCharge(ranked, 'fastest')?.charge
        const preciseCharge = pickCharge(ranked, 'precise')?.charge
        const bestCharge = pickCharge(ranked, 'best')?.charge
        const usableOnly = hideUnfit || onlyGood
        const visible = group.results.filter((r) => {
          if (usableOnly && r.solution === null) return false
          if (!onlyGood) return true
          const selected = group.mode === activeMode && r.charge === activeCharge
          return (
            selected ||
            r.charge === bestCharge ||
            r.charge === fastestCharge ||
            r.charge === preciseCharge
          )
        })
        // A trajectory that cannot reach the target disappears entirely when hiding is on
        if (visible.length === 0) return null
        const best = bestCharge
        const fastest = fastestCharge
        const precise = preciseCharge
        const several = ranked.filter((r) => r.solution !== null).length > 1
        return (
          <div key={group.mode}>
            {groups.length > 1 && (
              <p className="label mb-1.5 flex items-center gap-1.5">
                <FieldIcon
                  name={group.mode === 'HIGH' ? 'trajectoryHigh' : 'trajectoryLow'}
                  className="h-4 w-4"
                />
                {group.label}
              </p>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.25rem,1fr))] gap-1.5">
              {visible.map((result) => {
                const solution = result.solution
                const usable = solution !== null
                const active =
                  usable && group.mode === activeMode && result.charge === activeCharge
                const hit = usable ? blockedAt(result.charge) : null
                return (
                  <button
                    key={result.charge}
                    type="button"
                    disabled={!usable}
                    aria-pressed={active}
                    onClick={() => onPick(group.mode, result.charge)}
                    title={
                      hit
                        ? t('terrain.card-blocked', `${Math.round(hit.at)} ${t('unit.m')}`)
                        : usable
                        ? result.metersPerMil !== null
                          ? `1 ${unitMil} ≈ ${result.metersPerMil.toFixed(1)} ${t('unit.m')}`
                          : undefined
                        : `${result.minRange}–${result.maxRange} ${t('unit.m')}`
                    }
                    className={[
                      'relative flex flex-col items-start rounded-lg px-2.5 py-1.5 text-left transition-all duration-200',
                      active
                        ? hit
                          ? 'bg-danger-soft ring-1 ring-danger'
                          : 'bg-accent-soft ring-1 ring-accent'
                        : 'bg-app-raised',
                      usable
                        ? 'cursor-pointer hover:bg-app-raised-hover'
                        : 'cursor-not-allowed opacity-35',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-1.5">
                      <b className="text-lg leading-none text-app-text tabular-nums">
                        {result.charge}
                      </b>
                      {hit && (
                        <span className="text-danger">
                          <FieldIcon name="mountain" className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {usable && !hit && several && result.charge === best && (
                        <span title={t('chargeStrip.best-charge')} className="text-accent">
                          <FieldIcon name="balance" className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {usable && !hit && several && result.charge === fastest && (
                        <span title={t('chargeStrip.fastest')} className="text-warn">
                          <FieldIcon name="fire" className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {usable && !hit && several && result.charge === precise && (
                        <span title={t('chargeStrip.most-precise')} className="text-info">
                          <FieldIcon name="correction" className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>
                    <span
                      className={`mt-0.5 text-[12px] whitespace-nowrap tabular-nums ${hit ? 'text-danger line-through' : 'text-app-muted'}`}
                    >
                      {usable
                        ? `${Math.round(solution.elevation)} ${unitMil} · ${solution.tof.toFixed(1)} ${unitS}`
                        : `${result.minRange}–${result.maxRange} ${t('unit.m')}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
