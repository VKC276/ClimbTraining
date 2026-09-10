export type FontId =
  | 'atkinson'
  | 'inter'
  | 'source-sans'
  | 'ibm-plex'
  | 'system'

export type FontOption = {
  id: FontId
  label: string
  hint: string
  stack: string
}

export const fontOptions: FontOption[] = [
  {
    id: 'atkinson',
    label: 'Atkinson Hyperlegible',
    hint: 'Extra tydlig, bra på avstånd',
    stack: '"Atkinson Hyperlegible", "Segoe UI", sans-serif',
  },
  {
    id: 'inter',
    label: 'Inter',
    hint: 'Neutral och lättläst på skärm',
    stack: 'Inter, "Segoe UI", sans-serif',
  },
  {
    id: 'source-sans',
    label: 'Source Sans 3',
    hint: 'Klassisk, lugn text',
    stack: '"Source Sans 3", "Segoe UI", sans-serif',
  },
  {
    id: 'ibm-plex',
    label: 'IBM Plex Sans',
    hint: 'Tydliga siffror till klockan',
    stack: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
  {
    id: 'system',
    label: 'Systemets typsnitt',
    hint: 'Inbyggt, ingen extra nedladdning',
    stack: 'system-ui, "Segoe UI", sans-serif',
  },
]

export const defaultFontId: FontId = 'atkinson'

export function isFontId(value: unknown): value is FontId {
  return fontOptions.some((option) => option.id === value)
}

export function getFontOption(id: FontId): FontOption {
  return fontOptions.find((option) => option.id === id) ?? fontOptions[0]
}
