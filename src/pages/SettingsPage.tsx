import { Link } from 'react-router-dom'
import { fontOptions } from '../fonts'
import { clampDisplayZoom, displayZoomMax, displayZoomMin, idleTimeoutOptions } from '../gym/defaults'
import { useGym } from '../gym/GymContext'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import type { ClockStyle } from '../types'

export function SettingsPage() {
  const { snapshot, updateSettings, screenId, unpairScreen } = useGym()
  const { clockStyle, idleTimeoutMinutes, displayZoom, fontId, displayHardware } = snapshot.settings

  const patchHardware = (partial: Partial<typeof displayHardware>) => {
    updateSettings({
      displayHardware: { ...displayHardware, ...partial },
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

        <label className="field">
          <span>Grafikstorlek på gymskärmen {displayZoom} %</span>
          <input
            type="range"
            min={displayZoomMin}
            max={displayZoomMax}
            step={5}
            value={displayZoom}
            onChange={(event) =>
              updateSettings({ displayZoom: clampDisplayZoom(Number(event.target.value)) })
            }
          />
        </label>
        <div className="hdmi-toggle">
          <button
            className="button-ghost"
            type="button"
            onClick={() =>
              updateSettings({ displayZoom: clampDisplayZoom(displayZoom - 25) })
            }
          >
            Mindre
          </button>
          <button
            className="button-ghost"
            type="button"
            onClick={() =>
              updateSettings({ displayZoom: clampDisplayZoom(displayZoom + 25) })
            }
          >
            Större
          </button>
        </div>

        <fieldset>
          <legend>Gymskärm (Pi)</legend>
          <p className="settings-note">
            Styr volym och skärm på/av via HDMI-CEC. Pi:n måste köra gym-scriptet.
            På LG: slå på SIMPLINK (CEC).
          </p>
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
              className={displayHardware.hdmiOn ? 'button' : 'button-ghost'}
              type="button"
              onClick={() => patchHardware({ hdmiOn: true })}
            >
              Skärm på
            </button>
            <button
              className={!displayHardware.hdmiOn ? 'button' : 'button-ghost'}
              type="button"
              onClick={() => patchHardware({ hdmiOn: false })}
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
              <span className="choice-hint">
                TV:n slås på och av via HDMI-CEC vid tiderna nedan.
              </span>
            </span>
          </label>
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
        </fieldset>

        <p className="settings-note">
          Kopplad till skärm {screenId}. Koden syns nere till höger på
          gymskärmen i vila.
        </p>
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
