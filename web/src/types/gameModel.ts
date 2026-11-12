export type GameMode = 'HIGH' | 'LOW'

// The weapon class: sets the icon and the frame colour in the interface.
//   mortar: a mortar, towed: a towed gun (cannon, howitzer),
//   spg: self-propelled artillery, mlrs: a multiple rocket launcher.
export type ArtilleryCategory = 'mortar' | 'towed' | 'spg' | 'mlrs'

export interface GameModel {
  name: string
  mod: string
  category: ArtilleryCategory
  modes: readonly GameMode[]
  notes: string
}
