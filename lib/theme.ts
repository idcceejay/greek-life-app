/**
 * Rally — design tokens. Layout from "Greek Life App — UI Layout.pdf"
 * (Apple HIG + bento grid: soft gray canvas, white rounded cards).
 * Palette (10/01/26): slate #374151 for ink and the dark hero card, rose
 * #E11D48 as the accent.
 */
export const colors = {
  accent: '#E11D48',
  accentSoft: '#FFE4E6',
  /**
   * Darker rose for accent-coloured *text*. #E11D48 is 4.7:1 on white but
   * 3.9:1 on accentSoft, so text on light rose or the canvas uses this
   * (5.2:1 on accentSoft). Fills, buttons and icons keep the brighter `accent`.
   */
  accentInk: '#BE123C',
  /** Light rose text for labels that sit on the slate hero card (7.3:1). */
  accentOnDark: '#FECDD3',
  canvas: '#F3F4F6',
  card: '#FFFFFF',
  ink: '#374151',
  /** Dark slate fill for the one emphasised card on Home. */
  inkFill: '#374151',
  /** Body text on the slate card (7.0:1). */
  inkOnDark: '#D1D5DB',
  inkSecondary: '#4B5563',
  // The quietest text step. Must clear 4.5:1 on white, the canvas AND the
  // `fill` used by search fields and segmented controls — #5B6370 does
  // (6.1 / 5.5 / 4.9); the lighter #6B7280 fails on canvas and fill.
  inkTertiary: '#5B6370',
  separator: '#E5E7EB',
  /** Background of search fields and segmented controls. */
  fill: '#E5E7EB',
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
  // Sentence case, not tracked ALL CAPS: the small label above a card's title.
  eyebrow: { fontSize: 13, fontWeight: '600' as const, color: colors.accentInk },
} as const;

export const iconSize = { s: 18, m: 20, l: 24, tab: 25 } as const;
