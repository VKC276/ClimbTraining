import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fontOptions } from '../fonts'
import { clampIdleSize, idleSizeMax, idleSizeMin, idleTimeoutOptions } from '../gym/defaults'
import { useGym } from '../gym/GymContext'
import { TrainerCorner } from '../components/TrainerCorner'
import type { DisplayMode, HdmiCommand } from '../gym/displayHardware'
import { formatRadarIdleMinutes, radarIdleMinuteOptions } from '../gym/displayHardware'
import type { ClockStyle } from '../types'

function LockButton({
  locked,
  label,
  onToggle,
}: {
  locked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      className={locked ? 'lock-button' : 'lock-button lock-button-open'}
      type="button"
      aria-pressed={!locked}
      aria-label={locked ? `Lås upp ${label}` : `Lås ${label}`}
      onClick={onToggle}
    >
      {locked ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Zm7 13H7v-9h10v9Z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17 8h-1V6a4 4 0 0 0-7.8-1.2l1.6.8A2 2 0 0 1 14 6v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm0 11H7v-9h10v9Z"
          />
        </svg>
      )}
    </button>
  )
}

function LockedSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const [locked, setLocked] = useState(true)
  return (
    <div className="locked-slider">
      <label className="field">
        <span>
          {label} {value} %
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={locked}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
      <LockButton
        locked={locked}
        label={label}
        onToggle={() => setLocked((current) => !current)}
      />
    </div>
  )
}

export function SettingsPage() {
  const { snapshot, updateSettings, screenId, unpairScreen, syncReady, displayOnline } =
    useGym()
  const {
    clockStyle,
    idleTimeoutMinutes,
    idleLogoSize,
    idleClockSize,
    idleScreenIdSize,
    fontId,
    displayHardware,
  } = snapshot.settings

  const [hdmiPressed, setHdmiPressed] = useState<HdmiCommand | null>(null)

  const patchHardware = (partial: Partial<typeof displayHardware>) => {
    updateSettings({
      displayHardware: { ...displayHardware, ...partial },
    })
  }

  const pulseHdmi = (hdmiCommand: HdmiCommand) => {
    setHdmiPressed(hdmiCommand)
    window.setTimeout(() => setHdmiPressed(null), 180)
    patchHardware({
      hdmiOn: hdmiCommand === 'on',
      hdmiCommand,
      hdmiCommandId: Date.now(),
    })
  }

  if (!syncReady) {
    return (
      <main className="trainer-page settings-page">
        <header>
          <p className="eyebrow">Kontrollpanel</p>
          <h1>Inställningar</h1>
          <p className="lede">Hämtar senaste sparade värden från gymskärmen…</p>
          <TrainerCorner />
        </header>
        <p className="settings-note" role="status">
          {displayOnline ? `Kopplad till skärm ${screenId}.` : 'Väntar på synk…'}
        </p>
        <p className="trainer-footer">
          <Link className="button" to="/">
            Tillbaka till menyn
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main className="trainer-page settings-page">
      <header>
        <p className="eyebrow">Kontrollpanel</p>
        <h1>Inställningar</h1>
        <p className="lede">
          Viloläget visar logga och klocka. Under ett pass ligger klockan alltid
          digitalt uppe till höger.
        </p>
        <TrainerCorner />
      </header>

      <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
        <fieldset>
          <legend>Klocka i vila</legend>
          <label className={clockStyle === 'analog' ? 'choice selected' : 'choice'}>
            <input
              type="radio"
              name="clockStyle"
              checked={clockStyle === 'analog'}
              onChange={() => updateSettings({ clockStyle: 'analog' satisfies ClockStyle })}
            />
            Analog
          </label>
          <label className={clockStyle === 'digital' ? 'choice selected' : 'choice'}>
            <input
              type="radio"
              name="clockStyle"
              checked={clockStyle === 'digital'}
              onChange={() => updateSettings({ clockStyle: 'digital' satisfies ClockStyle })}
            />
            Digital
          </label>
        </fieldset>

        <fieldset>
          <legend>Teckensnitt</legend>
          {fontOptions.map((option) => (
            <label
              key={option.id}
              className={fontId === option.id ? 'choice selected' : 'choice'}
              style={{ fontFamily: option.stack }}
            >
              <input
                type="radio"
                name="fontId"
                checked={fontId === option.id}
                onChange={() => updateSettings({ fontId: option.id })}
              />
              <span>
                <strong>{option.label}</strong>
                <span className="choice-hint">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          <span>Inaktivitet innan viloläge</span>
          <select
            value={idleTimeoutMinutes}
            onChange={(event) =>
              updateSettings({ idleTimeoutMinutes: Number(event.target.value) })
            }
          >
            {idleTimeoutOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 1 ? '1 minut' : `${minutes} minuter`}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Storlek i vila</legend>
          <LockedSlider
            label="Logga"
            value={idleLogoSize}
            min={idleSizeMin}
            max={idleSizeMax}
            step={5}
            onChange={(idleLogoSize) => updateSettings({ idleLogoSize: clampIdleSize(idleLogoSize) })}
          />
          <LockedSlider
            label="Klocka"
            value={idleClockSize}
            min={idleSizeMin}
            max={idleSizeMax}
            step={5}
            onChange={(idleClockSize) =>
              updateSettings({ idleClockSize: clampIdleSize(idleClockSize) })
            }
          />
          <LockedSlider
            label="Skärmnummer"
            value={idleScreenIdSize}
            min={idleSizeMin}
            max={idleSizeMax}
            step={5}
            onChange={(idleScreenIdSize) =>
              updateSettings({ idleScreenIdSize: clampIdleSize(idleScreenIdSize) })
            }
          />
        </fieldset>

        <fieldset>
          <legend>Gymskärm</legend>
          <div className="hdmi-toggle">
            <button
              className={hdmiPressed === 'on' ? 'button' : 'button-ghost'}
              type="button"
              disabled={displayHardware.mode === 'off'}
              onClick={() => pulseHdmi('on')}
            >
              Skärm på
            </button>
            <button
              className={hdmiPressed === 'off' ? 'button' : 'button-ghost'}
              type="button"
              disabled={displayHardware.mode === 'off'}
              onClick={() => pulseHdmi('off')}
            >
              Skärm av
            </button>
          </div>

          <label className={displayHardware.mode === 'off' ? 'choice selected' : 'choice'}>
            <input
              type="radio"
              name="displayMode"
              checked={displayHardware.mode === 'off'}
              onChange={() => patchHardware({ mode: 'off' satisfies DisplayMode })}
            />
            <span>
              <strong>Av</strong>
              <span className="choice-hint">Inga CEC-kommandon</span>
            </span>
          </label>
          <label className={displayHardware.mode === 'schedule' ? 'choice selected' : 'choice'}>
            <input
              type="radio"
              name="displayMode"
              checked={displayHardware.mode === 'schedule'}
              onChange={() => patchHardware({ mode: 'schedule' satisfies DisplayMode })}
            />
            <span>
              <strong>Schema</strong>
              <span className="choice-hint">Tänd och släck enligt klockslag</span>
            </span>
          </label>
          <label className={displayHardware.mode === 'radar' ? 'choice selected' : 'choice'}>
            <input
              type="radio"
              name="displayMode"
              checked={displayHardware.mode === 'radar'}
              onChange={() => patchHardware({ mode: 'radar' satisfies DisplayMode })}
            />
            <span>
              <strong>Radar</strong>
              <span className="choice-hint">Tänd när någon är i zonen, släck efter timeout</span>
            </span>
          </label>

          {displayHardware.mode === 'schedule' ? (
            <div className="field-row">
              <label className="field">
                <span>På klockan</span>
                <input
                  type="time"
                  value={displayHardware.onTime}
                  onChange={(event) => patchHardware({ onTime: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Av klockan</span>
                <input
                  type="time"
                  value={displayHardware.offTime}
                  onChange={(event) => patchHardware({ offTime: event.target.value })}
                />
              </label>
            </div>
          ) : null}

          {displayHardware.mode === 'radar' ? (
            <label className="field">
              <span>Skärmen kvar efter att zonen blivit tom</span>
              <select
                value={displayHardware.radarIdleMinutes}
                onChange={(event) =>
                  patchHardware({ radarIdleMinutes: Number(event.target.value) })
                }
              >
                {radarIdleMinuteOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatRadarIdleMinutes(minutes)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>

        <p className="settings-note">Kopplad till skärm {screenId}.</p>
      </form>

      <p className="trainer-footer">
        <button className="button-ghost" type="button" onClick={unpairScreen}>
          Byt skärm
        </button>
        <Link className="button" to="/">
          Tillbaka till menyn
        </Link>
      </p>
    </main>
  )
}
