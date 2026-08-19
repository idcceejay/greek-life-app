import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, type } from '../lib/theme';

/**
 * White rounded bento card (HIG-style grouped surface).
 *
 * When `onPress` is set the card becomes a single screen-reader element: pass
 * `accessibilityLabel` so VoiceOver announces the card's purpose instead of
 * reading its children one by one.
 */
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [s.card, style, pressed && { opacity: 0.85 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

/**
 * Circular initials avatar on soft accent.
 *
 * The initials are always hidden from screen readers — "CP" read aloud is
 * noise, and next to a name it is duplication. Pass `label` (usually the
 * person's full name) only where the avatar is the sole identifier.
 */
export function Avatar({
  initials,
  size = 44,
  label,
}: {
  initials: string;
  size?: number;
  label?: string;
}) {
  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'auto' : 'no-hide-descendants'}
    >
      <Text style={[s.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

/** Soft accent pill ("RSVP · 24 going", "3 unread", "live"). */
export function Pill({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={s.pill}
    >
      <Text style={s.pillText}>{label}</Text>
    </Pressable>
  );
}

/** Outlined quick-action chip ("New event", "Post", "Poll"). */
export function ActionChip({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.chip, pressed && { opacity: 0.7 }]}
    >
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}

/** Large screen title, HIG large-title style. */
export function ScreenTitle({ children }: { children: string }) {
  return (
    <Text style={s.screenTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.l,
  },
  avatar: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accentInk, fontWeight: '700' },
  pill: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  pillText: { color: colors.accentInk, fontWeight: '600', fontSize: 14 },
  chip: {
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    // Apple HIG minimum tappable height.
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: { color: colors.accentInk, fontWeight: '600', fontSize: 15 },
  screenTitle: { ...type.largeTitle, marginBottom: spacing.l },
});
