/**
 * Rally — design tokens, derived from "Greek Life App — UI Layout.pdf"
 * (Apple HIG + bento-grid: soft gray canvas, white rounded cards, indigo accent).
 */
export const colors = {
  accent: '#5A5CF0',
  accentSoft: '#E9E9FC',
  /**
   * Darker indigo for accent-coloured *text*. #5A5CF0 is 4.97:1 on pure white
   * — fine — but drops to 4.15:1 on accentSoft and 4.43:1 on the canvas, both
   * under AA. Fills, buttons and icons keep the brighter `accent`.
   */
  accentInk: '#4A4CD6',
  canvas: '#F2F1F7',
  card: '#FFFFFF',
  ink: '#0B0B0F',
  inkSecondary: '#6E6E76',
  // Was #A6A6AE — only 2.4:1 on white, so placeholder text was effectively
  // invisible to low-vision users. #6B6B73 clears WCAG AA (4.5:1) and still
  // reads as the quietest step in the ink ramp.
  inkTertiary: '#6B6B73',
  separator: '#E5E5EA',
  // success/warning/danger are darkened from their iOS-system originals so
  // they pass 4.5:1 as *text*; use the originals only for large fills.
  success: '#1B7F35',
  warning: '#9A5B00',
  danger: '#D70015',
  mapTint: '#DCE7DC',
} as const;

export const radius = { card: 20, pill: 999, control: 12 } as const;

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, color: colors.ink },
  title2: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
  headline: { fontSize: 17, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 17, fontWeight: '400' as const, color: colors.ink },
  subhead: { fontSize: 15, fontWeight: '400' as const, color: colors.inkSecondary },
  caption: { fontSize: 13, fontWeight: '500' as const, color: colors.inkSecondary },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.accentInk,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
} as const;
