import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ApplyFont } from './components/ApplyFont'
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
          <Route path="/" element={<TrainerHomePage />} />
          <Route path="/pass/:activityId" element={<TrainerActivityPage />} />
          <Route path="/installningar" element={<SettingsPage />} />
          <Route path="/display" element={<DisplayPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GymProvider>
  )
}
