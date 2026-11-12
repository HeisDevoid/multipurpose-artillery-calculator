import { t } from '../i18n'
import { exportJournal, parseJournalFile, type JournalEntry } from './journal'

/** Download the target journal as a file. */
export function downloadJournal(entries: readonly JournalEntry[]) {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([exportJournal(entries)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `artillery-journal-${date}.json`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Read a journal file and add the targets; returns a message for
 * the user ("Added: 3. Already present: 1.").
 */
export async function importJournalFile(
  file: File,
  onImport: (entries: JournalEntry[]) => { added: number; skipped: number }
): Promise<string> {
  return describeImport(await file.text(), onImport)
}

/** The same from the file text (separately, to test without File). */
export function describeImport(
  text: string,
  onImport: (entries: JournalEntry[]) => { added: number; skipped: number }
): string {
  const parsed = parseJournalFile(text)
  if (parsed === null) {
    return t('journalIO.this-file-is-not-a')
  }
  const { added, skipped } = onImport(parsed.entries)
  return (
    t('journalIO.added-already-present', added, skipped) +
    (parsed.invalid > 0 ? ' ' + t('journalIO.damaged', parsed.invalid) : '')
  )
}

/** Journal actions the targets panel on the map calls by itself. */
export interface JournalActions {
  exportAll: () => void
  // File import; the result is a message for the user
  importFile: (file: File) => Promise<string>
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}
