import type {
  Ammunition,
  ArtilleryMode,
  ArtilleryReference,
  BallisticProfile,
} from '../types/artillery'

const MODES: readonly ArtilleryMode[] = ['HIGH', 'LOW']

/**
 * Whether a table was taken with air resistance. ACE shows weather corrections
 * (wind, temperature, air density) only with air resistance on:
 * a table with them is for advanced ballistics, one without them is for a game without it.
 */
export function hasDragData(profile: BallisticProfile | undefined): boolean {
  if (!profile) return false
  return Object.values(profile.modes).some(
    (tables) =>
      tables !== undefined &&
      Object.values(tables).some((rows) =>
        rows.some((row) => row.length > 5 && row.slice(5).some((value) => value !== null))
      )
  )
}

export interface ProfileChoice {
  profile: BallisticProfile | undefined
  // Trajectories that have no tables for the selected physics: tables of the
  // other physics are used, and the calculator warns about it
  substituted: ArtilleryMode[]
}

// The merged profile is not rebuilt on every render
const merged = new WeakMap<BallisticProfile, WeakMap<BallisticProfile, BallisticProfile>>()

/**
 * Tables for the ammunition for the selected physics (advanced is a game with
 * air resistance). The advanced profile is always with air resistance; the plain one
 * is with it if it has weather corrections (such weapons have no tables without
 * air resistance yet). Trajectories missing from the needed tables
 * are taken from the tables of the other physics and go into substituted.
 */
export function selectProfile(
  reference: Pick<ArtilleryReference, 'profiles'>,
  ammo: Pick<Ammunition, 'profile' | 'advancedProfile'> | undefined,
  advanced: boolean
): ProfileChoice {
  const profiles = reference.profiles
  const normal = ammo?.profile !== undefined ? profiles?.[ammo.profile] : undefined
  const adv = ammo?.advancedProfile !== undefined ? profiles?.[ammo.advancedProfile] : undefined
  const normalHasDrag = hasDragData(normal)
  const withDrag = adv ?? (normalHasDrag ? normal : undefined)
  const withoutDrag = normalHasDrag ? undefined : normal

  const preferred = advanced ? withDrag : withoutDrag
  const other = advanced ? withoutDrag : withDrag
  if (!preferred) return { profile: other, substituted: other ? MODES.filter((m) => other.modes[m]) : [] }

  const substituted = MODES.filter((m) => !preferred.modes[m] && other?.modes[m])
  if (!other || substituted.length === 0) return { profile: preferred, substituted: [] }

  let byOther = merged.get(preferred)
  if (!byOther) merged.set(preferred, (byOther = new WeakMap()))
  let profile = byOther.get(other)
  if (!profile) {
    profile = { ...preferred, modes: { ...other.modes, ...preferred.modes } }
    byOther.set(other, profile)
  }
  return { profile, substituted }
}
