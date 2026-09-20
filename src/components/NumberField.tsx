import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'] as const

function clamp(raw: string, min: number, max: number, step: number, fallback: number) {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return fallback
  const snapped = step > 1 ? Math.round(parsed / step) * step : parsed
  return Math.min(max, Math.max(min, snapped))
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumberFieldProps) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const replaceNext = useRef(true)
  const maxDigits = String(Math.max(Math.abs(min), Math.abs(max))).length

  const close = () => setOpen(false)

  const commit = (raw: string) => {
    const next = clamp(raw, min, max, step, value)
    onChange(next)
    close()
  }

  const openPad = () => {
    setDraft(String(value))
    replaceNext.current = true
    setOpen(true)
  }

  const typeDigit = (digit: string) => {
    setDraft((current) => {
      const next = replaceNext.current ? digit : `${current}${digit}`.replace(/^0+(?=\d)/, '')
      replaceNext.current = false
      return next.slice(0, maxDigits)
    })
  }

  const backspace = () => {
    replaceNext.current = false
    setDraft((current) => current.slice(0, -1))
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        commit(draft)
        return
      }
      if (event.key === 'Backspace') {
        event.preventDefault()
        backspace()
        return
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault()
        typeDigit(event.key)
      }
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, draft, min, max, step, value])

  const pad = open
    ? createPortal(
        <div
          className="number-pad-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <div
            className="number-pad"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <p className="eyebrow" id={titleId}>
              {label}
            </p>
            <p className="number-pad-value" aria-live="polite">
              {draft === '' ? '—' : draft}
            </p>
            <p className="number-pad-range">
              {min}–{max}
            </p>
            <div className="number-pad-keys">
              {KEYS.map((key) => {
                if (key === 'back') {
                  return (
                    <button
                      key={key}
                      className="number-pad-key number-pad-action"
                      type="button"
                      onClick={backspace}
                      aria-label="Radera"
                    >
                      ⌫
                    </button>
                  )
                }
                if (key === 'ok') {
                  return (
                    <button
                      key={key}
                      className="number-pad-key number-pad-ok"
                      type="button"
                      onClick={() => commit(draft)}
                    >
                      Klar
                    </button>
                  )
                }
                return (
                  <button
                    key={key}
                    className="number-pad-key"
                    type="button"
                    onClick={() => typeDigit(key)}
                  >
                    {key}
                  </button>
                )
              })}
            </div>
            <button className="button-ghost number-pad-cancel" type="button" onClick={close}>
              Avbryt
            </button>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="field">
      <span>{label}</span>
      <button
        className="number-field-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}, ${value}`}
        onClick={openPad}
      >
        {value}
      </button>
      {pad}
    </div>
  )
}
