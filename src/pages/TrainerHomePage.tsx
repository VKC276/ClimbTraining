import { Link } from 'react-router-dom'
import { activities } from '../activities'
import { Logo } from '../components/Logo'
import { TrainerCorner } from '../components/TrainerCorner'
import { useGym } from '../gym/GymContext'

export function TrainerHomePage() {
  const { startActivity } = useGym()

  return (
    <main className="trainer-page">
      <TrainerCorner />
      <header className="trainer-header">
        <Logo className="trainer-logo" />
        <div>
          <p className="eyebrow">Kontrollpanel</p>
          <h1>Välj träningsmoment</h1>
          <p className="lede">Momentet visas på gymskärmen.</p>
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
