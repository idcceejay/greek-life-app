import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { ActionChip, Avatar, Card, Pill } from '../../components/ui';
import { useSession } from '../../lib/useSession';
import {
  useMyOrg,
  useEvents,
  useChats,
  usePendingCount,
  createOrganization,
  listSchoolOrgs,
  requestJoin,
  Org,
} from '../../lib/data';
import { useMyCharges } from '../../lib/dues';
import { colors, radius, spacing, type } from '../../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { session, profile } = useSession();
  const userId = session?.user.id;
  const { membership, loading: orgLoading, refresh: refreshOrg } = useMyOrg(userId);
  const { events, refresh: refreshEvents } = useEvents(membership?.org.id);
  const { chats, refresh: refreshChats } = useChats(userId);
  const { outstanding: duesOwed, refresh: refreshDues } = useMyCharges();
  const { count: pendingCount, refresh: refreshPending } = usePendingCount(membership?.org.id);
  const isAdmin = membership?.role === 'admin';

  const [showOrg, setShowOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshOrg();
      refreshEvents();
      refreshChats();
      refreshDues();
      refreshPending();
    }, [refreshOrg, refreshEvents, refreshChats, refreshDues, refreshPending]),
  );

  useEffect(() => {
    if (showOrg) listSchoolOrgs().then(setOrgs);
  }, [showOrg]);

  const upcoming = events.filter((e) => dayjs(e.starts_at).isAfter(dayjs().subtract(2, 'hour')));
  const next = upcoming[0];

  const initials =
    (profile?.full_name ?? profile?.username ?? 'Me')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'ME';

  const onAvatar = () => {
    router.push('/settings');
  };

  const doCreateOrg = async () => {
    setErr(null);
    if (orgName.trim().length < 3) return setErr('Name needs at least 3 characters.');
    const res = await createOrganization(orgName.trim(), 'fraternity');
    if (!res.ok)
      return setErr(
        res.error === 'students_only'
          ? 'Only verified students can create an organization.'
          : res.error,
      );
    setShowOrg(false);
    setOrgName('');
    refreshOrg();
  };

  const doJoin = async (org: Org) => {
    if (!userId) return;
    const res = await requestJoin(org.id, userId);
    setPendingMsg(
      res.ok
        ? `Request sent to ${org.name} — an admin needs to approve it.`
        : res.error.includes('duplicate')
          ? `You already have a request in with ${org.name}.`
          : res.error,
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.headerRow}>
          <View>
            <Text style={type.caption}>
              {membership ? membership.org.type : profile?.account_type === 'student' ? 'Student' : 'Account'}
            </Text>
            <Text style={type.largeTitle} numberOfLines={1}>
              {membership?.org.name ?? (profile?.full_name?.split(' ')[0] ?? 'Home')}
            </Text>
          </View>
          <Pressable
            onPress={onAvatar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            accessibilityHint="Opens settings"
          >
            <Avatar initials={initials} size={40} />
          </Pressable>
        </View>

        {/* No org yet → onboarding card */}
        {!orgLoading && !membership && (
          <Card style={s.block}>
            <Text style={type.eyebrow}>Get started</Text>
            <Text style={[type.title2, s.heroTitle]}>Set up your chapter</Text>
            <Text style={[type.subhead, { marginBottom: spacing.m }]}>
              Create your organization, or request to join one that already exists at your school.
            </Text>
            <View style={s.actionsRow}>
              <ActionChip label="Create or join" onPress={() => setShowOrg(true)} />
            </View>
          </Card>
        )}

        {/* Next event hero */}
        {membership && (
          <Card style={s.block} onPress={() => router.push('/(tabs)/calendar')}>
            {next ? (
              <>
                <Text style={type.eyebrow}>
                  Next event · {dayjs(next.starts_at).format('ddd h:mm A')}
                </Text>
                <Text style={[type.title2, s.heroTitle]}>{next.title}</Text>
                {next.location_text && <Pill label={next.location_text} />}
              </>
            ) : (
              <>
                <Text style={type.eyebrow}>Calendar</Text>
                <Text style={[type.title2, s.heroTitle]}>No upcoming events</Text>
                <Pill label="+ Add one" />
              </>
            )}
          </Card>
        )}

        {/* Bento pair */}
        {membership && (
          <View style={s.row}>
            <Card style={[s.block, s.half]} onPress={() => router.push('/(tabs)/map')}>
              <View style={s.tileGlyph} />
              <Text style={type.headline}>Live Map</Text>
              <Text style={type.subhead}>See who's around</Text>
            </Card>
            <Card style={[s.block, s.half]} onPress={() => router.push('/dues')}>
              <View style={s.tileGlyph} />
              <Text style={type.headline}>Dues</Text>
              <Text
                style={[
                  type.subhead,
                  duesOwed > 0 && { color: colors.warning, fontWeight: '600' },
                ]}
              >
                {duesOwed > 0 ? `$${(duesOwed / 100).toFixed(0)} due` : 'All paid up'}
              </Text>
            </Card>
          </View>
        )}

        {/* Members. Pending requests are invisible until an admin sees them, so
            the count is surfaced here rather than only inside the screen. */}
        {membership && (
          <Card style={s.block} onPress={() => router.push('/members')}>
            <View style={s.membersRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.headline}>Members</Text>
                <Text
                  style={[
                    type.subhead,
                    isAdmin && pendingCount > 0 && { color: colors.warning, fontWeight: '600' },
                  ]}
                >
                  {isAdmin && pendingCount > 0
                    ? `${pendingCount} waiting to join`
                    : 'Roster and roles'}
                </Text>
              </View>
              {isAdmin && pendingCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Chats */}
        <Card style={s.block} onPress={() => router.push('/(tabs)/chats')}>
          <View style={s.cardHeaderRow}>
            <View style={s.inlineTitle}>
              <View style={s.tileGlyphSmall} />
              <Text style={type.headline}>Chats</Text>
            </View>
          </View>
          <Text style={type.subhead} numberOfLines={1}>
            {chats[0]?.lastMessage
              ? `${chats[0].name ?? 'Chat'}: ${chats[0].lastMessage}`
              : 'No messages yet'}
          </Text>
        </Card>

        {/* Feed */}
        <Card style={s.block} onPress={() => router.push('/(tabs)/feed')}>
          <View style={s.cardHeaderRow}>
            <View style={s.inlineTitle}>
              <View style={s.tileGlyphSmall} />
              <Text style={type.headline}>Campus Feed</Text>
            </View>
            {profile?.account_type === 'student' && <Pill label="open" />}
          </View>
          <Text style={type.subhead}>
            {profile?.account_type === 'student'
              ? 'Anonymous posts from your campus'
              : 'Verify a .edu email to unlock'}
          </Text>
        </Card>

        {membership && (
          <View style={s.actionsRow}>
            <ActionChip label="New event" onPress={() => router.push('/(tabs)/calendar')} />
            <ActionChip label="Post" onPress={() => router.push('/(tabs)/feed')} />
          </View>
        )}
      </ScrollView>

      {/* Create/join org modal */}
      <Sheet visible={showOrg} onClose={() => setShowOrg(false)}>
        <View style={s.modal}>
            <Text style={[type.title2, { marginBottom: spacing.s }]}>Your chapter</Text>
            <Text style={type.caption}>Create a new organization</Text>
            <View style={s.joinRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Organization name"
                placeholderTextColor={colors.inkTertiary}
                value={orgName}
                onChangeText={setOrgName}
              />
              <Pressable style={s.mBtnSmall} onPress={doCreateOrg}>
                <Text style={s.mBtnText}>Create</Text>
              </Pressable>
            </View>
            {orgs.length > 0 && (
              <>
                <Text style={[type.caption, { marginTop: spacing.m }]}>
                  Or request to join
                </Text>
                {orgs.slice(0, 6).map((o) => (
                  <Pressable key={o.id} style={s.orgRow} onPress={() => doJoin(o)}>
                    <Text style={type.headline}>{o.name}</Text>
                    <Text style={s.joinLink}>Request</Text>
                  </Pressable>
                ))}
              </>
            )}
            {pendingMsg && <Text style={[type.subhead, { marginTop: spacing.s }]}>{pendingMsg}</Text>}
            {err && <Text style={s.err}>{err}</Text>}
            <Pressable
              style={[s.mBtn, s.mBtnGhost, { marginTop: spacing.m }]}
              onPress={() => setShowOrg(false)}
            >
              <Text style={[s.mBtnText, { color: colors.ink }]}>Close</Text>
          </Pressable>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.l, paddingBottom: spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.l,
  },
  block: { marginBottom: spacing.m },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  heroTitle: { marginTop: 4, marginBottom: spacing.m, fontSize: 26 },
  row: { flexDirection: 'row', gap: spacing.m },
  half: { flex: 1 },
  tileGlyph: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.m,
  },
  tileGlyphSmall: { width: 22, height: 22, borderRadius: 7, backgroundColor: colors.accentSoft },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  inlineTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  actionsRow: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.s },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.s,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
  },
  joinRow: { flexDirection: 'row', gap: spacing.s, alignItems: 'center' },
  orgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    marginTop: spacing.xs,
  },
  joinLink: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  err: { color: colors.danger, fontSize: 14 },
  mBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  mBtnSmall: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 13,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
  },
  mBtnGhost: { backgroundColor: colors.card },
  mBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
