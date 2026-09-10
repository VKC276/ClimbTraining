import { Link } from 'react-router-dom'
import { fontOptions } from '../fonts'
import { idleTimeoutOptions } from '../gym/defaults'
import { useGym } from '../gym/GymContext'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import type { ClockStyle } from '../types'

export function SettingsPage() {
  const { snapshot, updateSettings, screenId, unpairScreen } = useGym()
  const { clockStyle, idleTimeoutMinutes, fontId } = snapshot.settings

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
