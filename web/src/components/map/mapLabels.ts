import { t, type MessageKey } from '../../i18n'
import type { MapMarker, MarkerColor, PresetColor } from '../../lib/markers'

const COLOR_NAMES: Record<PresetColor, MessageKey> = {
  red: 'mapPicker.red',
  orange: 'mapPicker.orange',
  yellow: 'mapPicker.yellow',
  green: 'mapPicker.green',
  blue: 'mapPicker.blue',
  purple: 'mapPicker.purple',
  black: 'mapPicker.black',
}

/** The colour name for a label; a custom colour is called "Colour". */
export function colorName(color: MarkerColor): string {
  return color.startsWith('#') ? t('mapPicker.colour') : t(COLOR_NAMES[color as PresetColor])
}

/** A marker label: its text or "Marker (colour)". */
export function markerTitle(marker: MapMarker): string {
  return marker.label || `${t('mapPicker.marker')} (${colorName(marker.color)})`
}
