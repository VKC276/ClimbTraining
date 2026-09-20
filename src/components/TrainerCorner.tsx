import { useGym } from '../gym/GymContext'

export function TrainerCorner() {
  const { snapshot, updateSettings } = useGym()
  const hardware = snapshot.settings.displayHardware

  const turnScreenOn = () => {
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
    <div className="trainer-corner">
      <button
        className="trainer-screen-btn"
        type="button"
        aria-label="Skärm på"
        title="Skärm på"
        onClick={turnScreenOn}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M13 3h-2v10h2V3Zm4.83 2.17-1.42 1.42A6.97 6.97 0 0 1 19 12a7 7 0 1 1-14 0c0-2.05.88-3.89 2.29-5.2L5.87 5.38A8.96 8.96 0 0 0 3 12a9 9 0 1 0 18 0 8.96 8.96 0 0 0-3.17-6.83Z"
          />
        </svg>
      </button>
    </div>
  )
}
