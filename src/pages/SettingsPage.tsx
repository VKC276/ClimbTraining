import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fontOptions } from '../fonts'
import { clampIdleSize, idleSizeMax, idleSizeMin, idleTimeoutOptions } from '../gym/defaults'
import { useGym } from '../gym/GymContext'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import type { HdmiCommand } from '../gym/displayHardware'
import type { ClockStyle } from '../types'

function SizeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      <span>
        {label} {value} %
      </span>
      <input
        type="range"
        min={idleSizeMin}
        max={idleSizeMax}
        step={5}
        value={value}
        onChange={(event) => onChange(clampIdleSize(Number(event.target.value)))}
      />
    </label>
  )
}

export function SettingsPage() {
  const { snapshot, updateSettings, screenId, unpairScreen } = useGym()
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

  return (
    <main className="trainer-page settings-page">
      <header>
        <p className="eyebrow">Kontrollpanel</p>
        <h1>Inställningar</h1>
        <p className="lede">
          Viloläget visar logga och klocka. Under ett pass ligger klockan alltid
          digitalt uppe till höger.
        </p>
        <SyncStatusBadge />
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
          <SizeField
            label="Logga"
            value={idleLogoSize}
            onChange={(idleLogoSize) => updateSettings({ idleLogoSize })}
          />
          <SizeField
            label="Klocka"
            value={idleClockSize}
            onChange={(idleClockSize) => updateSettings({ idleClockSize })}
          />
          <SizeField
            label="Skärmnummer"
            value={idleScreenIdSize}
            onChange={(idleScreenIdSize) => updateSettings({ idleScreenIdSize })}
          />
        </fieldset>

        <fieldset>
          <legend>Gymskärm</legend>
          <label className="field">
            <span>Volym {displayHardware.volume} %</span>
            <input
              type="range"
              min={0}
              max={100}
              value={displayHardware.volume}
              onChange={(event) =>
                patchHardware({ volume: Number(event.target.value) })
              }
            />
          </label>
          <div className="hdmi-toggle">
            <button
              className={hdmiPressed === 'on' ? 'button' : 'button-ghost'}
              type="button"
              onClick={() => pulseHdmi('on')}
            >
              Skärm på
            </button>
            <button
              className={hdmiPressed === 'off' ? 'button' : 'button-ghost'}
              type="button"
              onClick={() => pulseHdmi('off')}
            >
              Skärm av
            </button>
          </div>
          <label className={displayHardware.scheduleEnabled ? 'choice selected' : 'choice'}>
            <input
              type="checkbox"
              checked={displayHardware.scheduleEnabled}
              onChange={(event) =>
                patchHardware({ scheduleEnabled: event.target.checked })
              }
            />
            <span>
              <strong>Schema</strong>
            </span>
          </label>
          <div className="field-row">
            <label className="field">
              <span>På klockan</span>
              <input
                type="time"
                value={displayHardware.onTime}
                onChange={(event) =>
                patchHardware({
                  onTime: event.target.value,
                  scheduleEnabled: true,
                })
              }
              />
            </label>
            <label className="field">
              <span>Av klockan</span>
              <input
                type="time"
                value={displayHardware.offTime}
                onChange={(event) =>
                patchHardware({
                  offTime: event.target.value,
                  scheduleEnabled: true,
                })
              }
              />
            </label>
          </div>
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
