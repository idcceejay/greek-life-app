import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Avatar, Card } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useSession } from '../lib/useSession';
import {
  useMyOrg,
  useMembers,
  approveMember,
  declineMember,
  setMemberRole,
  removeMember,
  MEMBER_ROLES,
  MemberRole,
  MemberRow,
} from '../lib/data';
import { colors, radius, spacing, type } from '../lib/theme';

// Registered per-screen in this codebase (see chats.tsx, feed.tsx) so a screen
// never depends on another having been loaded first.
dayjs.extend(relativeTime);

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: 'Admin',
  treasurer: 'Treasurer',
  user: 'Member',
  alumni: 'Alumni',
};

/** Pending applicants can fall outside profiles_read, so name may be missing. */
function displayName(m: MemberRow) {
  return m.fullName ?? (m.username ? `@${m.username}` : 'Pending member');
}

function initials(m: MemberRow) {
  const n = m.fullName ?? m.username ?? '?';
  return n
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function MembersScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { membership } = useMyOrg(userId);
  const orgId = membership?.org.id;
  const isAdmin = membership?.role === 'admin';

  const { pending, active, alumni, loading, error, refresh } = useMembers(orgId);

  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const run = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (!res.ok) {
      // trg_protect_last_admin and the alumni-not-admin trigger both return
      // messages written for people, so show them as-is.
      Alert.alert('Could not do that', res.error ?? 'Something went wrong.');
      return;
    }
    setSelected(null);
    refresh();
  };

  const onApprove = (m: MemberRow) => run(m.id, () => approveMember(m.id));

  const onDecline = (m: MemberRow) =>
    Alert.alert('Decline request?', `${displayName(m)} will not join. They can ask again later.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => run(m.id, () => declineMember(m.id)) },
    ]);

  const onRole = (m: MemberRow, role: MemberRole) => run(m.id, () => setMemberRole(m.id, role));

  const onRemove = (m: MemberRow) =>
    Alert.alert(
      'Remove from chapter?',
      `${displayName(m)} loses access to chapter events, chats, and dues. They can be added back later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => run(m.id, () => removeMember(m.id)),
        },
      ]
    );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={s.back}>Back</Text>
        </Pressable>
        <Text style={type.headline} accessibilityRole="header">
          Members
        </Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {!membership && !loading && (
          <Card style={s.card}>
            <Text style={type.body}>You are not in a chapter yet.</Text>
            <Text style={type.caption}>Join or create one from the Home tab.</Text>
          </Card>
        )}

        {loading && (
          <View style={s.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {error && (
          <Card style={s.card}>
            <Text style={s.err} accessibilityLiveRegion="assertive" accessibilityRole="alert">
              {error}
            </Text>
            <Pressable
              onPress={refresh}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={s.link}>Try again</Text>
            </Pressable>
          </Card>
        )}

        {/* Pending first: this is the only part that needs action. */}
        {isAdmin && pending.length > 0 && (
          <Card style={s.card}>
            <Text style={type.eyebrow}>
              {pending.length} request{pending.length === 1 ? '' : 's'}
            </Text>
            {pending.map((m) => (
              <View key={m.id} style={s.pendingRow}>
                <Avatar initials={initials(m)} />
                <View style={s.grow}>
                  <Text style={type.body}>{displayName(m)}</Text>
                  <Text style={type.caption}>asked {dayjs(m.joinedAt).fromNow()}</Text>
                </View>
                {busyId === m.id ? (
                  <ActivityIndicator
                    color={colors.accent}
                    accessibilityLabel={`Updating ${displayName(m)}`}
                  />
                ) : (
                  <View style={s.actions}>
                    <Pressable
                      style={s.approve}
                      onPress={() => onApprove(m)}
                      hitSlop={{ top: 8, bottom: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${displayName(m)}`}
                    >
                      <Text style={s.approveText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDecline(m)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Decline ${displayName(m)}`}
                    >
                      <Text style={s.decline}>Decline</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}

        {!isAdmin && pending.length > 0 && (
          <Card style={s.card}>
            <Text style={type.caption}>
              {pending.length} pending request{pending.length === 1 ? '' : 's'}. An admin can approve
              them.
            </Text>
          </Card>
        )}

        {/* Active roster */}
        {membership && (
          <Card style={s.card}>
            <Text style={type.eyebrow}>{active.length} members</Text>
            {active.length === 0 && !loading && (
              <Text style={type.caption}>No active members yet.</Text>
            )}
            {active.map((m) => (
              <Pressable
                key={m.id}
                style={s.row}
                disabled={!isAdmin}
                onPress={() => setSelected(m)}
                accessibilityRole={isAdmin ? 'button' : 'text'}
                accessibilityLabel={`${displayName(m)}, ${ROLE_LABEL[m.role]}${
                  m.userId === userId ? ', you' : ''
                }`}
                accessibilityHint={isAdmin ? 'Change role or remove from chapter' : undefined}
              >
                <Avatar initials={initials(m)} />
                <View style={s.grow}>
                  <Text style={type.body}>{displayName(m)}</Text>
                  <Text style={type.caption}>
                    {ROLE_LABEL[m.role]}
                    {m.userId === userId ? ' · you' : ''}
                  </Text>
                </View>
                {isAdmin && (
                  <Text style={s.chevron} accessibilityElementsHidden>
                    ›
                  </Text>
                )}
              </Pressable>
            ))}
          </Card>
        )}

        {alumni.length > 0 && (
          <Card style={s.card}>
            <Text style={type.eyebrow}>{alumni.length} alumni</Text>
            {alumni.map((m) => (
              <Pressable
                key={m.id}
                style={s.row}
                disabled={!isAdmin}
                onPress={() => setSelected(m)}
                accessibilityRole={isAdmin ? 'button' : 'text'}
                accessibilityLabel={`${displayName(m)}, alumni`}
                accessibilityHint={isAdmin ? 'Change role or remove from chapter' : undefined}
              >
                <Avatar initials={initials(m)} />
                <View style={s.grow}>
                  <Text style={type.body}>{displayName(m)}</Text>
                  <Text style={type.caption}>Alumni</Text>
                </View>
                {isAdmin && (
                  <Text style={s.chevron} accessibilityElementsHidden>
                    ›
                  </Text>
                )}
              </Pressable>
            ))}
          </Card>
        )}

        {membership && !isAdmin && (
          <Text style={s.footnote}>Only admins can approve requests or change roles.</Text>
        )}
      </ScrollView>

      {/* Role + remove sheet */}
      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        label={selected ? displayName(selected) : undefined}
      >
        <View style={s.sheet}>
          {selected && (
            <>
              <Text style={type.title2} accessibilityRole="header">
                {displayName(selected)}
              </Text>
              <Text style={type.caption}>
                Joined {dayjs(selected.joinedAt).format('MMM D, YYYY')}
              </Text>

              <Text style={[type.eyebrow, { marginTop: spacing.m }]}>Role</Text>
              {MEMBER_ROLES.map((r) => {
                const on = selected.role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    style={[s.roleRow, on && s.roleRowOn]}
                    onPress={() => (on ? undefined : onRole(selected, r.key))}
                    accessibilityRole="radio"
                    accessibilityLabel={`${r.label}. ${r.blurb}`}
                    accessibilityState={{ checked: on }}
                  >
                    <View style={s.grow}>
                      <Text style={type.body}>{r.label}</Text>
                      <Text style={type.caption}>{r.blurb}</Text>
                    </View>
                    {on && (
                      <Text style={s.check} accessibilityElementsHidden>
                        ✓
                      </Text>
                    )}
                  </Pressable>
                );
              })}

              <Pressable
                style={s.removeBtn}
                onPress={() => onRemove(selected)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${displayName(selected)} from chapter`}
              >
                <Text style={s.removeText}>Remove from chapter</Text>
              </Pressable>

              <Text style={type.caption}>
                A chapter must always keep at least one admin. Promote someone else first if you are
                changing the last one.
              </Text>
            </>
          )}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  back: { color: colors.accent, fontSize: 17, fontWeight: '600', width: 64 },
  scroll: { padding: spacing.l, gap: spacing.m, paddingBottom: spacing.xxl },
  card: { gap: spacing.s },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  grow: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  approve: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.l,
    paddingVertical: 8,
  },
  approveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  decline: { color: colors.inkSecondary, fontSize: 15, fontWeight: '600' },
  chevron: { color: colors.inkTertiary, fontSize: 22, fontWeight: '400' },
  link: { color: colors.accent, fontSize: 16, fontWeight: '600', paddingVertical: 6 },
  err: { color: colors.danger, fontSize: 14 },
  footnote: { ...type.caption, textAlign: 'center', marginTop: spacing.s },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.s,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  roleRowOn: { backgroundColor: colors.accentSoft },
  check: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  removeBtn: {
    borderRadius: radius.control,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.m,
    backgroundColor: colors.card,
  },
  removeText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
