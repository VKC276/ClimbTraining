import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ApplyFont } from './components/ApplyFont'
import { TrainerShell } from './components/TrainerShell'
import { GymProvider } from './gym/GymContext'
import { DisplayPage } from './pages/DisplayPage'
import { SettingsPage } from './pages/SettingsPage'
import { TrainerActivityPage } from './pages/TrainerActivityPage'
import { TrainerHomePage } from './pages/TrainerHomePage'

export default function App() {
  return (
    <GymProvider>
      <ApplyFont />
      <BrowserRouter>
        <Routes>
          <Route path="/display" element={<DisplayPage />} />
          <Route element={<TrainerShell />}>
            <Route path="/" element={<TrainerHomePage />} />
            <Route path="/pass/:activityId" element={<TrainerActivityPage />} />
            <Route path="/installningar" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GymProvider>
  )
}
