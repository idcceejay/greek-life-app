import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { ActionChip, Avatar, Card, Chevron, Icon, IconName, IconTile } from '../../components/ui';
import { useSession } from '../../lib/useSession';
import {
  useMyOrg,
  useEvents,
  useChats,
  useMembers,
  usePendingCount,
  createOrganization,
  listSchoolOrgs,
  requestJoin,
  Org,
} from '../../lib/data';
import { useMyCharges, useOrgDues } from '../../lib/dues';
import { colors, iconSize, radius, spacing, type } from '../../lib/theme';

/** "fraternity" → "Fraternity" for the label above the chapter name. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One tappable row on a Home card: icon tile, title + subtitle, chevron. */
function RowCard({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  warn,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  trailing?: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <Card style={s.block} onPress={onPress} accessibilityLabel={`${title}. ${subtitle}`}>
      <View style={s.rowCard}>
        <IconTile name={icon} />
        <View style={{ flex: 1 }}>
          <Text style={type.headline}>{title}</Text>
          <Text
            style={[type.subhead, warn && { color: colors.warning, fontWeight: '600' }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
        {trailing}
        <Chevron />
      </View>
    </Card>
  );
}

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
  // Setup progress is admin-only (only admins can do the steps), so the roster
  // and dues summary are only fetched for admins.
  const adminOrgId = isAdmin ? membership?.org.id : undefined;
  const { active: activeMembers, refresh: refreshMembers } = useMembers(adminOrgId);
  const { members: duesRows, refresh: refreshOrgDues } = useOrgDues(adminOrgId);

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
      refreshMembers();
      refreshOrgDues();
    }, [refreshOrg, refreshEvents, refreshChats, refreshDues, refreshPending, refreshMembers, refreshOrgDues]),
  );

  useEffect(() => {
    if (showOrg) listSchoolOrgs().then(setOrgs);
  }, [showOrg]);

  const upcoming = events.filter((e) => dayjs(e.starts_at).isAfter(dayjs().subtract(2, 'hour')));
  const next = upcoming[0];

  // "Build your chapter": every step is checked against real data, never
  // faked. Ordered so the first unchecked one is the obvious next action.
  const setupSteps = [
    { label: 'Create your chapter', done: true },
    {
      label:
        activeMembers.length > 1 ? `Invite members (${activeMembers.length} joined)` : 'Invite members',
      done: activeMembers.length > 1,
      go: () => router.push('/members'),
    },
    {
      label: 'Add your first event',
      done: events.length > 0,
      go: () => router.push({ pathname: '/(tabs)/calendar', params: { new: '1' } }),
    },
    {
      label: 'Set up dues',
      done: duesRows.some((m) => m.owed_cents > 0 || m.paid_cents > 0),
      go: () => router.push('/dues'),
    },
  ];
  const doneCount = setupSteps.filter((st) => st.done).length;
  const nextStep = setupSteps.find((st) => !st.done);
  const showSetup = isAdmin && !!nextStep;
  const newEvent = () => router.push({ pathname: '/(tabs)/calendar', params: { new: '1' } });

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
              {membership ? capitalize(membership.org.type) : profile?.account_type === 'student' ? 'Student' : 'Account'}
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

        {/* Build your chapter: admin-only, real progress, hidden once done */}
        {membership && showSetup && nextStep && (
          <Card style={s.block}>
            <View style={s.setupHead}>
              <Text style={type.headline} accessibilityRole="header">
                Build your chapter
              </Text>
              <Text style={s.setupCount}>
                {doneCount} of {setupSteps.length} done
              </Text>
            </View>
            <View
              style={s.progressTrack}
              accessibilityRole="progressbar"
              accessibilityLabel="Chapter setup"
              accessibilityValue={{ min: 0, max: setupSteps.length, now: doneCount }}
            >
              <View style={[s.progressFill, { width: `${(doneCount / setupSteps.length) * 100}%` }]} />
            </View>
            {setupSteps.map((st) =>
              st.done ? (
                <View key={st.label} style={s.stepRow}>
                  <View style={s.stepDone}>
                    <Icon name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                  <Text style={s.stepDoneText}>{st.label}</Text>
                </View>
              ) : st === nextStep ? (
                <Pressable
                  key={st.label}
                  onPress={st.go}
                  accessibilityRole="button"
                  accessibilityLabel={`Next step: ${st.label}`}
                  style={({ pressed }) => [s.stepRow, s.stepNext, pressed && { opacity: 0.6 }]}
                >
                  <View style={s.stepTodo} />
                  <Text style={[type.subhead, s.stepNextText]}>{st.label}</Text>
                  <Icon name="chevron-forward" size={iconSize.s} />
                </Pressable>
              ) : null,
            )}
            {setupSteps.filter((st) => !st.done).length > 1 && (
              <Text style={s.stepLater}>
                Then: {setupSteps.filter((st) => !st.done && st !== nextStep).map((st) => st.label.toLowerCase()).join(', ')}
              </Text>
            )}
          </Card>
        )}

        {/* Next event: the one emphasised (slate) card on Home */}
        {membership && (
          <Card
            style={[s.block, s.hero]}
            onPress={() => router.push('/(tabs)/calendar')}
            accessibilityLabel={
              next
                ? `Next event: ${next.title}, ${dayjs(next.starts_at).format('dddd h:mm A')}`
                : 'Calendar. No upcoming events'
            }
          >
            {next ? (
              <>
                <Text style={s.heroEyebrow}>
                  Next event, {dayjs(next.starts_at).format('ddd h:mm A')}
                </Text>
                <Text style={s.heroTitle}>{next.title}</Text>
                {next.location_text ? <Text style={s.heroBody}>{next.location_text}</Text> : null}
              </>
            ) : (
              <>
                <Text style={s.heroEyebrow}>Calendar</Text>
                <Text style={s.heroTitle}>No upcoming events</Text>
                <Text style={[s.heroBody, { marginBottom: spacing.m }]}>Plan the next chapter meetup.</Text>
                <Pressable
                  onPress={newEvent}
                  accessibilityRole="button"
                  accessibilityLabel="New event"
                  style={({ pressed }) => [s.heroBtn, pressed && { opacity: 0.85 }]}
                >
                  <Icon name="add" size={iconSize.s} />
                  <Text style={s.heroBtnText}>New event</Text>
                </Pressable>
              </>
            )}
          </Card>
        )}

        {/* Bento pair */}
        {membership && (
          <View style={s.row}>
            <Card
              style={[s.block, s.half]}
              onPress={() => router.push('/(tabs)/map')}
              accessibilityLabel="Live Map. See who's around"
            >
              <IconTile name="location" />
              <Text style={[type.headline, s.tileTitle]}>Live Map</Text>
              <Text style={type.subhead}>See who's around</Text>
            </Card>
            <Card
              style={[s.block, s.half]}
              onPress={() => router.push('/dues')}
              accessibilityLabel={`Dues. ${duesOwed > 0 ? `$${(duesOwed / 100).toFixed(0)} due` : 'All paid up'}`}
            >
              <IconTile name="wallet" />
              <Text style={[type.headline, s.tileTitle]}>Dues</Text>
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
          <RowCard
            icon="people"
            title="Members"
            subtitle={isAdmin && pendingCount > 0 ? `${pendingCount} waiting to join` : 'Roster and roles'}
            warn={isAdmin && pendingCount > 0}
            onPress={() => router.push('/members')}
            trailing={
              isAdmin && pendingCount > 0 ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{pendingCount}</Text>
                </View>
              ) : undefined
            }
          />
        )}

        <RowCard
          icon="chatbubbles"
          title="Chats"
          subtitle={
            chats[0]?.lastMessage
              ? `${chats[0].name ?? 'Chat'}: ${chats[0].lastMessage}`
              : 'No messages yet'
          }
          onPress={() => router.push('/(tabs)/chats')}
        />

        <RowCard
          icon="megaphone"
          title="Campus Feed"
          subtitle={
            profile?.account_type === 'student'
              ? 'Anonymous posts from your campus'
              : 'Verify a .edu email to unlock'
          }
          onPress={() => router.push('/(tabs)/feed')}
        />
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
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
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
  // Setup progress card
  setupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  setupCount: { fontSize: 13, fontWeight: '600', color: colors.accentInk },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
    marginTop: spacing.m,
    marginBottom: spacing.s,
  },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  stepNext: { minHeight: 44 },
  stepDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDoneText: { fontSize: 15, color: colors.inkSecondary, textDecorationLine: 'line-through' },
  stepTodo: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.accent },
  stepNextText: { flex: 1, color: colors.ink, fontWeight: '600' },
  stepLater: { ...type.caption, paddingLeft: 32 },
  // Slate hero: the one emphasised card on Home
  hero: { backgroundColor: colors.inkFill, borderRadius: 24, padding: spacing.xl - 4 },
  heroEyebrow: { ...type.eyebrow, color: colors.accentOnDark },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', marginTop: 4, marginBottom: 4 },
  heroBody: { fontSize: 15, color: colors.inkOnDark },
  heroBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  heroBtnText: { color: colors.accentInk, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.m },
  half: { flex: 1, gap: 2 },
  tileTitle: { marginTop: spacing.m },
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
