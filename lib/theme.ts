/**
 * Rally — design tokens, derived from "Greek Life App — UI Layout.pdf"
 * (Apple HIG + bento-grid: soft gray canvas, white rounded cards, indigo accent).
 */
export const colors = {
  accent: '#5A5CF0',
  accentSoft: '#E9E9FC',
  canvas: '#F2F1F7',
  card: '#FFFFFF',
  ink: '#0B0B0F',
  inkSecondary: '#6E6E76',
  inkTertiary: '#A6A6AE',
  separator: '#E5E5EA',
  success: '#34C759',
  warning: '#E08700',
  danger: '#FF3B30',
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
    color: colors.accent,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
} as const;
