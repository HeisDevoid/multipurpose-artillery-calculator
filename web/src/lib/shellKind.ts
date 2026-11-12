export type ShellKind = 'he' | 'illum' | 'smoke'

/** The shell kind from the type name in the tables: HE, ILLUM, SMOKE… */
export function shellKind(type: string): ShellKind {
  if (/ill|flare|star/i.test(type)) return 'illum'
  if (/smoke|smk|\bwp\b|\bhc\b/i.test(type)) return 'smoke'
  return 'he'
}
