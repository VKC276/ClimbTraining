import { useState, type FormEvent } from 'react'
import { Logo } from '../components/Logo'
import { isScreenId, normalizeScreenId } from '../gym/screenId'
import { useGym } from '../gym/GymContext'

export function HallGatePage() {
  const { pairScreen, unpairScreen, screenId: pairedId } = useGym()
  const [value, setValue] = useState('')
  const screenId = normalizeScreenId(value)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (isScreenId(screenId)) pairScreen(screenId)
  }

  if (pairedId && isScreenId(pairedId)) {
    return (
      <main className="trainer-page hall-gate">
        <Logo className="trainer-logo" />
        <p className="eyebrow">Anslut till skärm</p>
        <h1>Kopplar upp mot skärm</h1>
        <p className="lede">
          Väntar på gymskärmen. Den måste vara igång och ha internet. Verktygen
          öppnas när ni är kopplade — tills dess händer inget på storskärmen.
        </p>
        <p className="screen-id-waiting" role="status">
          {pairedId}
        </p>
        <button className="button-ghost" type="button" onClick={unpairScreen}>
          Avbryt
        </button>
      </main>
    )
  }

  return (
    <main className="trainer-page hall-gate">
      <Logo className="trainer-logo" />
      <p className="eyebrow">Anslut till skärm</p>
      <h1>Ange skärm-id</h1>
      <p className="lede">
        Koden står nere till höger på gymskärmen när den är i vila. Fyra tecken.
      </p>
      <form className="screen-id-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Skärm-id</span>
          <input
            value={value}
            onChange={(event) => setValue(normalizeScreenId(event.target.value))}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            inputMode="text"
            maxLength={4}
            aria-label="Skärm-id"
          />
        </label>
        <button className="button" type="submit" disabled={!isScreenId(screenId)}>
          Anslut
        </button>
      </form>
    </main>
  )
}
