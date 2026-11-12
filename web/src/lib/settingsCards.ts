/**
 * Settings sections collapse (so that an item is not touched by accident while scrolling);
 * the open ones are remembered. A jump from the chip on top opens the section.
 */
export const SETTINGS_CARD_OPEN = 'settings-card-open'

export function openSettingsCard(id: string) {
  window.dispatchEvent(new CustomEvent<string>(SETTINGS_CARD_OPEN, { detail: id }))
}

export const settingsCardKey = (id: string) => `settingsOpen:${id}`
