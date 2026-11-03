/**
 * Разделы настроек сворачиваются (так при прокрутке не задеть пункт случайно);
 * раскрытые запоминаются. Переход по чипу сверху раскрывает раздел.
 */
export const SETTINGS_CARD_OPEN = 'settings-card-open'

export function openSettingsCard(id: string) {
  window.dispatchEvent(new CustomEvent<string>(SETTINGS_CARD_OPEN, { detail: id }))
}

export const settingsCardKey = (id: string) => `settingsOpen:${id}`
