import type { ReactNode } from 'react'

/** The intro paragraph of a screen: a short idea and an explanation under it. */
export function PageIntro({
  title,
  children,
}: {
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-lg font-medium text-app-text">{title}</p>
      {children && (
        <p className="mt-2 text-[15px] leading-relaxed text-app-muted">
          {children}
        </p>
      )}
    </div>
  )
}
