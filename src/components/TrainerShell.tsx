import { Outlet } from 'react-router-dom'
import { useGym } from '../gym/GymContext'
import { HallGatePage } from '../pages/HallGatePage'

export function TrainerShell() {
  const { hasScreenAccess } = useGym()
  if (!hasScreenAccess) return <HallGatePage />
  return <Outlet />
}
