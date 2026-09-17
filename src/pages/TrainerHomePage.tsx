import { useState } from 'react'
import { Link } from 'react-router-dom'
import { activities } from '../activities'
import { Logo } from '../components/Logo'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { useGym } from '../gym/GymContext'

export function TrainerHomePage() {
  const { startActivity, snapshot, updateSettings } = useGym()
  const hardware = snapshot.settings.displayHardware
  const [hdmiPressed, setHdmiPressed] = useState(false)

  const turnScreenOn = () => {
    setHdmiPressed(true)
    window.setTimeout(() => setHdmiPressed(false), 180)
    updateSettings({
      displayHardware: {
        ...hardware,
        hdmiOn: true,
        hdmiCommand: 'on',
        hdmiCommandId: Date.now(),
      },
    })
  }

  return (
    <main className="trainer-page">
      <header className="trainer-header">
        <div className="trainer-brand">
          <Logo className="trainer-logo" />
          {!hardware.hdmiOn ? (
            <button
              className={hdmiPressed ? 'button' : 'button-ghost'}
              type="button"
              onClick={turnScreenOn}
            >
              Skärm på
            </button>
          ) : null}
        </div>
        <div>
          <p className="eyebrow">Kontrollpanel</p>
          <h1>Välj träningsmoment</h1>
          <p className="lede">
            Momentet visas på gymskärmen.
          </p>
          <SyncStatusBadge />
        </div>
      </header>

      <nav className="activity-grid" aria-label="Träningsmoment">
        {activities.map((activity) => (
          <Link
            key={activity.id}
            className="activity-card"
            to={`/pass/${activity.id}`}
            onClick={() => startActivity(activity.id)}
          >
            <strong>{activity.title}</strong>
            <span>{activity.description}</span>
          </Link>
        ))}
      </nav>

      <footer className="trainer-footer">
        <Link className="button button-ghost" to="/installningar">
          Inställningar
        </Link>
        <Link className="button button-ghost" to="/display">
          Öppna gymskärm
        </Link>
      </footer>
    </main>
  )
}
