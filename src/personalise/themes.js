// Colour palettes for the personalised home. Each template has a default palette,
// and the last onboarding question can swap it for any `selectable` one.
//
//   bg       page background (the "main" colour)
//   surface  normal cards
//   soft     secondary tinted cards
//   hero     the big highlight card (the "secondary" colour)
//   heroText text on the hero card
//   heroBar  progress bar fill on the hero card
//   text / muted  body text on bg / surface / soft
//   accent   buttons, bars, slider knob
//   onAccent text on accent
//   link     small text links on bg (accent is sometimes too light for text)
//   track    empty part of progress bars on bg
//   dark     true if bg is dark (status bar goes light)

export const PALETTES = {
  westpac: {
    label: 'Westpac red + navy',
    selectable: true,
    bg: '#F5F5F7', surface: '#FFFFFF', soft: '#ECEAF6',
    hero: '#D5002B', heroText: '#FFFFFF', heroBar: '#FFFFFF',
    text: '#1F1C4F', muted: '#6B6A80',
    accent: '#D5002B', onAccent: '#FFFFFF', link: '#D5002B', track: '#E2E0EC',
    dark: false,
  },
  forest: {
    label: 'Forest + mint',
    selectable: true,
    bg: '#F4F7F4', surface: '#FFFFFF', soft: '#DCEBE2',
    hero: '#1F5C45', heroText: '#FFFFFF', heroBar: '#FFFFFF',
    text: '#0F2A1F', muted: '#5B6B63',
    accent: '#1F5C45', onAccent: '#FFFFFF', link: '#1F5C45', track: '#CFE0D6',
    dark: false,
  },
  lavender: {
    label: 'Lavender + violet',
    selectable: true,
    bg: '#F3F0FF', surface: '#FFFFFF', soft: '#E5EBCB',
    hero: '#E3DBF7', heroText: '#2A2140', heroBar: '#6B46C1',
    text: '#2A2140', muted: '#6B6380',
    accent: '#6B46C1', onAccent: '#FFFFFF', link: '#6B46C1', track: '#D8D0F0',
    dark: false,
  },
  sand: {
    label: 'Sand + rust',
    selectable: true,
    bg: '#FBF6EF', surface: '#FFFFFF', soft: '#F6E7DA',
    hero: '#F3D9C6', heroText: '#3A2418', heroBar: '#9C3D1F',
    text: '#2E2018', muted: '#7A685C',
    accent: '#9C3D1F', onAccent: '#FFFFFF', link: '#9C3D1F', track: '#E8D3C3',
    dark: false,
  },
  midnight: {
    label: 'Midnight + coral',
    selectable: true,
    bg: '#13283A', surface: '#1D3549', soft: '#24405A',
    hero: '#F4B4A0', heroText: '#2A1A14', heroBar: '#9C3D1F',
    text: '#FFFFFF', muted: '#A9B8C6',
    accent: '#F4A28A', onAccent: '#13283A', link: '#F4A28A', track: '#2E4A63',
    dark: true,
  },
  ocean: {
    label: 'Ocean + sky',
    selectable: true,
    bg: '#EEF6FB', surface: '#FFFFFF', soft: '#D7ECF7',
    hero: '#0B5C8A', heroText: '#FFFFFF', heroBar: '#FFFFFF',
    text: '#0B2536', muted: '#56707F',
    accent: '#0B5C8A', onAccent: '#FFFFFF', link: '#0B5C8A', track: '#C9E0EE',
    dark: false,
  },
  plum: {
    label: 'Plum + gold',
    selectable: true,
    bg: '#FAF5F8', surface: '#FFFFFF', soft: '#F1E4EC',
    hero: '#5B2150', heroText: '#FFFFFF', heroBar: '#E3B04B',
    text: '#2B0F26', muted: '#7B6274',
    accent: '#C8932E', onAccent: '#2B0F26', link: '#5B2150', track: '#E6D3DF',
    dark: false,
  },
  // Template-only palettes (not offered in the colour question, to keep it short)
  slate: {
    label: 'Slate + amber',
    bg: '#F3F4F6', surface: '#FFFFFF', soft: '#FFF4D6',
    hero: '#2F3B4C', heroText: '#FFFFFF', heroBar: '#F2B705',
    text: '#1C2430', muted: '#5F6B7A',
    accent: '#E0A100', onAccent: '#1C2430', link: '#8A6200', track: '#DDE1E7',
    dark: false,
  },
  charcoal: {
    label: 'Charcoal + lime',
    bg: '#1A1C1E', surface: '#26292C', soft: '#2F3336',
    hero: '#C6F24E', heroText: '#1A1C1E', heroBar: '#1A1C1E',
    text: '#F4F5F2', muted: '#A2A8A0',
    accent: '#C6F24E', onAccent: '#1A1C1E', link: '#C6F24E', track: '#3A3F42',
    dark: true,
  },
  sage: {
    label: 'Sage + terracotta',
    bg: '#F2F4EE', surface: '#FFFFFF', soft: '#DFE6D3',
    hero: '#C8664A', heroText: '#FFFFFF', heroBar: '#FFFFFF',
    text: '#26301F', muted: '#66705E',
    accent: '#C8664A', onAccent: '#FFFFFF', link: '#A84E34', track: '#D6DCCB',
    dark: false,
  },
};

// Spacing and type scale for the "condensed" vs "spaced out" answer.
export const DENSITY = {
  compact: { pad: 16, gap: 10, section: 22, radius: 14, cardPad: 14, hero: 30, title: 22, body: 14, small: 12 },
  spacious: { pad: 20, gap: 16, section: 32, radius: 20, cardPad: 20, hero: 36, title: 26, body: 15, small: 13 },
};
