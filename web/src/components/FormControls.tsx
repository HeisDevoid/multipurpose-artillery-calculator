import { useEffect, useRef, useState, type ReactNode } from 'react'

import { isInvalid } from '../lib/input'
import { FieldIcon, type FieldIconName } from './FieldIcon'

export const inputClass = 'field field-lg'

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  // Enter in the field (for example, "Apply the burst")
  onEnter?: () => void
  className?: string
  // An element to the right of the label (for example, a switch)
  aside?: ReactNode
  placeholder?: string
  hint?: ReactNode
  // A text field without a number check (for example, coordinates)
  inputMode?: 'decimal' | 'numeric'
  validate?: boolean
  // A hint icon before the label
  icon?: FieldIconName
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  className,
  aside,
  placeholder = '0',
  hint,
  inputMode = 'decimal',
  onEnter,
  validate = true,
  icon,
}: FieldProps) {
  const invalid = validate && isInvalid(value)

  return (
    <div className={className}>
      {/* A fixed height of the label row: fields in neighbouring
          columns line up even when one of them has a switch. */}
      <div className="mb-1.5 flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <label htmlFor={id} className="label flex min-w-0 items-center gap-1.5">
          {icon && <FieldIcon name={icon} />}
          {label}
        </label>
        {aside}
      </div>

      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={
          onEnter
            ? (event) => {
                if (event.key === 'Enter') onEnter()
              }
            : undefined
        }
        placeholder={placeholder}
        aria-invalid={invalid}
        className={inputClass}
      />

      {hint && <p className="mt-1.5 text-xs text-app-muted">{hint}</p>}
    </div>
  )
}

interface ToggleProps<T extends string> {
  value: T
  options: readonly {
    value: T
    label: string
    disabled?: boolean
    icon?: FieldIconName
    // A tooltip on hover (none by default)
    title?: string
  }[]
  onChange: (value: T) => void
  label: string
  className?: string
  // Icons only: the label stays in the tooltip and for the screen reader
  iconOnly?: boolean
  // Buttons of equal width (a grid): it does not depend on label length in different languages
  equal?: boolean
}

export function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
  iconOnly = false,
  equal = false,
}: ToggleProps<T>) {
  const ref = useRef<HTMLDivElement>(null)
  // A sliding "pill" under the selected button: the switch glides
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  // Equal columns: when a label does not fit, the icons are hidden first (1),
  // then the font shrinks (2), then the columns are split by label length (3),
  // and as a last resort the label wraps (4). No ellipsis: the text is always fully visible.
  const [fit, setFit] = useState(0)
  const widthRef = useRef(0)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const measure = () => {
      if (equal) {
        // It got wider: try with the icons again
        if (root.clientWidth > widthRef.current + 8 && widthRef.current > 0) setFit(0)
        widthRef.current = root.clientWidth
        const overflow = [...root.querySelectorAll<HTMLElement>('button > span')].some(
          (span) => span.scrollWidth > span.clientWidth + 1
        )
        if (overflow) setFit((level) => Math.min(4, level + 1))
      }
      const el = root.querySelector<HTMLElement>('button[aria-pressed="true"]')
      setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null)
    }
    const frame = requestAnimationFrame(measure)
    // Button widths change when the font finishes loading or the language changes
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    root.querySelectorAll('button').forEach((b) => observer.observe(b))
    void document.fonts?.ready.then(measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [value, options.length, equal, fit])

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-pill={pill ? '' : undefined}
      className={`seg ${equal ? `!grid grid-flow-col ${fit >= 3 ? 'auto-cols-auto' : 'auto-cols-fr'}` : ''} ${className}`}
    >
      {pill && (
        <span
          aria-hidden="true"
          className="seg-pill"
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          title={iconOnly ? option.label : option.title}
          aria-label={iconOnly ? option.label : undefined}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={
            equal
              ? `min-w-0 justify-center !px-1.5 ${fit >= 2 ? '!text-[12px] !tracking-tight' : ''}`
              : undefined
          }
        >
          {option.icon && !(equal && fit >= 1) && (
            <FieldIcon name={option.icon} className={iconOnly ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5'} />
          )}
          {!iconOnly && (
            <span
              className={
                equal
                  ? fit >= 4
                    ? 'min-w-0 leading-tight [overflow-wrap:anywhere]'
                    : 'min-w-0 overflow-hidden whitespace-nowrap'
                  : undefined
              }
            >
              {option.label}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/** A section heading (an optional element on the right). */
export function SectionHeading({
  title,
  aside,
  as: Tag = 'h3',
}: {
  // The old section number is no longer shown
  index?: string
  title: string
  aside?: ReactNode
  as?: 'h2' | 'h3' | 'h4'
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <Tag className="font-semibold text-app-text">{title}</Tag>
      {aside}
    </div>
  )
}

/** A progress bar 0…1; alert is red (splash, impact). */
export function ProgressBar({
  progress,
  alert = false,
  className = '',
}: {
  progress: number
  alert?: boolean
  className?: string
}) {
  const percent = Math.min(1, Math.max(0, progress)) * 100
  return (
    <div className={`progress ${className}`} data-alert={alert} role="presentation">
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}

/** An on/off switch with a label and a description. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: ReactNode
  disabled?: boolean
}) {
  // Only the toggle itself switches (with a margin for a finger), not the whole row:
  // on a phone it is easy to touch the label or the description while scrolling
  return (
    <div className={['flex items-start justify-between gap-4', disabled ? 'opacity-50' : ''].join(' ')}>
      <span className="min-w-0">
        <span className="block text-[15px] leading-snug font-medium text-app-text">{label}</span>
        {description && (
          <span className="mt-1 block text-[13px] leading-relaxed text-app-muted">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="-m-2 shrink-0 cursor-pointer rounded-full p-2 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-solid disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className={[
            'relative mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors',
            checked ? 'bg-accent-solid' : 'bg-app-raised-hover',
          ].join(' ')}
        >
          <span
            className={[
              'absolute h-5 w-5 rounded-full bg-white shadow transition-all',
              checked ? 'left-[22px]' : 'left-[2px]',
            ].join(' ')}
          />
        </span>
      </button>
    </div>
  )
}

/** A "label: value" list row (inside a <dl>). */
export function Row({
  label,
  htmlFor,
  icon,
  control,
  unit,
  tourId,
  children,
}: {
  label: ReactNode
  htmlFor?: string
  icon?: FieldIconName
  // One width for the controls on the right: full is the whole width, unit is a field
  // with a unit on the right (the units line up in one column). On a phone
  // the controls are narrower, so that the labels on the left (~9 rem) fit on one line.
  control?: 'full' | 'unit'
  unit?: string
  // For the tutorial: the highlighted row
  tourId?: string
  children: ReactNode
}) {
  return (
    <div className="row" data-tour={tourId}>
      <dt className="flex min-w-0 items-center gap-2">
        {icon && <FieldIcon name={icon} className="h-[18px] w-[18px] text-app-muted" />}
        <span className="min-w-0">
          {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
        </span>
      </dt>
      {/* Fields of one width do not shrink: a long label wraps, and the fields
          in all rows start on the same line */}
      <dd className={['flex items-center justify-end gap-2', control ? 'shrink-0' : 'min-w-0'].join(' ')}>
        {control ? (
          <>
            <div
              className={[
                'flex min-w-0 items-center gap-2',
                control === 'unit'
                  ? 'w-[13.5rem] max-w-[calc(100vw-14.25rem)]'
                  : 'w-[16rem] max-w-[calc(100vw-11.75rem)]',
              ].join(' ')}
            >
              {children}
            </div>
            {control === 'unit' && (
              <span className="w-8 shrink-0 text-left whitespace-nowrap text-app-muted">{unit}</span>
            )}
          </>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}

/** A number field right in a list row, with the units on the right. */
export function InlineNumber({
  id,
  value,
  onChange,
  unit,
  placeholder = '0',
  label,
  readOnly = false,
  block = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  unit?: string
  placeholder?: string
  // A label for the screen reader when the row has no <label>
  label?: string
  // The field takes the full width of the container (in a row with one width)
  block?: boolean
  readOnly?: boolean
}) {
  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={isInvalid(value)}
        readOnly={readOnly}
        className={`field ${block ? 'h-9 min-w-0 flex-1 text-right' : 'field-inline'} ${readOnly ? 'opacity-60' : ''}`}
      />
      {unit && <span className="w-7 text-left text-app-muted">{unit}</span>}
    </>
  )
}
