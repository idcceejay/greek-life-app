import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { colors, iconSize, radius, spacing, type } from '../lib/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Ionicons glyph. Decorative by default: almost every icon sits beside text
 * that already names it, so VoiceOver skips it. Pass `label` only when the
 * icon stands alone and carries meaning.
 */
export function Icon({
  name,
  size = iconSize.m,
  color = colors.accent,
  label,
}: {
  name: IconName;
  size?: number;
  color?: string;
  label?: string;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'auto' : 'no-hide-descendants'}
    />
  );
}

/** Rounded light-rose square holding a card's icon. */
export function IconTile({ name }: { name: IconName }) {
  return (
    <View style={s.tile}>
      <Icon name={name} />
    </View>
  );
}

/** Trailing chevron on a tappable row or card. */
export function Chevron() {
  return <Icon name="chevron-forward" size={iconSize.s} color={colors.inkSecondary} />;
}

/**
 * Shared top bar for pushed screens (Dues, Members, Settings): back arrow +
 * "Back" on the left, centred title. One component so every screen's back
 * button looks and reads the same.
 */
export function BackHeader({ title }: { title: string }) {
  return (
    <View style={s.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
      >
        <Icon name="chevron-back" size={iconSize.l} />
        <Text style={s.backText}>Back</Text>
      </Pressable>
      <Text style={type.headline} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={s.headerSpacer} />
    </View>
  );
}

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
  tile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s,
    minHeight: 48,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 44, width: 88 },
  backText: { color: colors.accent, fontSize: 17 },
  headerSpacer: { width: 88 },
});
