type LogoProps = {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 129.82813 114.92076"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      shapeRendering="geometricPrecision"
      aria-label="Västerviks Klätterklubb"
    >
      <path d="M50.590531 98.846173 0.55166274 0H47.788264L71.807225 43.712737 81.014384 27.172855 67.803939 0h47.236921l14.01081 27.172855-37.229092 71.673318z" />
      <text
        x="64.91"
        y="111.6"
        textAnchor="middle"
        fontFamily="Verdana, Arial, sans-serif"
        fontWeight="700"
        fontSize="8"
      >
        VÄSTERVIKS KLÄTTERKLUBB
      </text>
    </svg>
  )
}
