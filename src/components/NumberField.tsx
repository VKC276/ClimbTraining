import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

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
  const focused = useRef(false)
  const [text, setText] = useState(String(value))

  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  const commit = () => {
    const next = clamp(text, min, max, step, value)
    onChange(next)
    setText(String(next))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    event.currentTarget.blur()
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        value={text}
        aria-label={label}
        onFocus={(event) => {
          focused.current = true
          event.currentTarget.select()
        }}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d]/g, '')
          setText(next)
          if (next === '') return
          const parsed = Number.parseInt(next, 10)
          if (!Number.isFinite(parsed)) return
          if (parsed < min || parsed > max) return
          if (step > 1 && parsed % step !== 0) return
          onChange(parsed)
        }}
        onBlur={() => {
          focused.current = false
          commit()
        }}
        onKeyDown={onKeyDown}
      />
    </label>
  )
}
