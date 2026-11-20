/**
 * Feature switches. Flip a value and ship. These are plain JavaScript, so turning
 * a feature back on can go out as an EAS Update without a new App Store build
 * (as long as the feature itself needs no new native module).
 *
 * 1.0 (App Store launch):
 * - dues: off. Comes back as "Money" (Stripe Connect + money requests + optional
 *   spending statement) once the LLC and Stripe account exist. See
 *   Project-Plan/Launch-Plan-v2.md, Phase 5. The screen and data code stay in
 *   place: app/dues.tsx, lib/dues.ts.
 * - feed: off. The anonymous campus feed was cut from v1 on 2026-08-24 (UNFORGET
 *   U2). Shipping it needs a pre-publish filter, a moderator queue, a EULA and a
 *   17+ age rating.
 */
export const FEATURES = {
  dues: false,
  feed: false,
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}
