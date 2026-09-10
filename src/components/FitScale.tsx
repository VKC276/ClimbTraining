import { useLayoutEffect, useRef, type ReactNode } from 'react'

type FitScaleProps = {
  children: ReactNode
  className?: string
}

export function FitScale({ children, className }: FitScaleProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return

    const fit = () => {
      if (box.clientWidth < 8 || box.clientHeight < 8) return
      let lo = 0.25
      let hi = 8
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2
        inner.style.setProperty('--fit', String(mid))
        const ok =
          inner.scrollWidth <= box.clientWidth + 2 &&
          inner.scrollHeight <= box.clientHeight + 2
        if (ok) lo = mid
        else hi = mid
      }
      inner.style.setProperty('--fit', String(lo))
    }

    const resize = new ResizeObserver(fit)
    resize.observe(box)
    const mutate = new MutationObserver(fit)
    mutate.observe(inner, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    fit()
    return () => {
      resize.disconnect()
      mutate.disconnect()
    }
  }, [])

  return (
    <div ref={boxRef} className={className}>
      <div ref={innerRef} className="fit-scale-inner">
        {children}
      </div>
    </div>
  )
}
