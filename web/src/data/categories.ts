import type { ArtilleryCategory } from '../types/gameModel'
import type { MessageKey } from '../i18n'

export const categoryLabels: Record<ArtilleryCategory, MessageKey> = {
  mortar: 'mapPicker.mortar',
  towed: 'categories.towed-gun',
  spg: 'categories.self-propelled-gun',
  mlrs: 'categories.rocket-artillery',
}

// The weapon class is a coloured dot in the top left corner of the icon:
// a mortar is green, artillery (towed and self-propelled) is yellow,
// rocket artillery (special) is purple.
export const categoryMarks: Record<ArtilleryCategory, string> = {
  mortar: 'bg-ok',
  towed: 'bg-warn',
  spg: 'bg-warn',
  mlrs: 'bg-special',
}
