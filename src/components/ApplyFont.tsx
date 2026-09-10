import { useEffect } from 'react'
import { useGym } from '../gym/GymContext'

export function ApplyFont() {
  const fontId = useGym().snapshot.settings.fontId

  useEffect(() => {
    document.documentElement.dataset.font = fontId
  }, [fontId])

  return null
}
