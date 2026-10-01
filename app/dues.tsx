import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { Avatar, Card, Pill } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useSession } from '../lib/useSession';
import { useMyOrg } from '../lib/data';
import {
  useMyCharges,
  useOrgDues,
  createDuesCycle,
  recordManualPayment,
  startCheckout,
  startStripeOnboarding,
  stripeStatus,
  chargesForMember,
  money,
  MemberBalance,
  MyCharge,
} from '../lib/dues';
import { colors, radius, spacing, type } from '../lib/theme';

export default function DuesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { membership } = useMyOrg(userId);
  const isTreasurer = membership?.role === 'admin' || membership?.role === 'treasurer';

  const [tab, setTab] = useState<'mine' | 'chapter'>('mine');
  const { charges, outstanding, loading, refresh } = useMyCharges();
  const { members, totalOwed, totalPaid, refresh: refreshOrg } = useOrgDues(
    isTreasurer ? membership?.org.id : undefined,
  );

  const [stripe, setStripe] = useState({ connected: false, active: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // New dues cycle form
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Member drill-down
  const [openMember, setOpenMember] = useState<MemberBalance | null>(null);
  const [memberCharges, setMemberCharges] = useState<
    { id: string; description: string | null; amount_cents: number; due_date: string | null; status: string }[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshOrg();
    }, [refresh, refreshOrg]),
  );

  useEffect(() => {
    if (membership?.org.id) stripeStatus(membership.org.id).then(setStripe);
  }, [membership?.org.id]);

  useEffect(() => {
    if (openMember && membership?.org.id) {
      chargesForMember(membership.org.id, openMember.user_id).then((c) =>
        setMemberCharges(c as typeof memberCharges),
      );
    }
  }, [openMember, membership?.org.id]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  };

  const pay = async (charge: MyCharge) => {
    setBusy(charge.id);
    const res = await startCheckout(charge.id);
    setBusy(null);
    if (!res.ok) return flash(res.error);
    Linking.openURL(res.url);
  };

  const connectStripe = async () => {
    if (!membership) return;
    setBusy('stripe');
    const res = await startStripeOnboarding(membership.org.id);
    setBusy(null);
    if (!res.ok) return flash(res.error);
    Linking.openURL(res.url);
  };

  const submitCycle = async () => {
    setErr(null);
    if (!membership) return;
    if (name.trim().length < 2) return setErr('Give the dues cycle a name.');
    const dollars = Number(amount.replace(/[^0-9.]/g, ''));
    if (!dollars || dollars <= 0) return setErr('Enter an amount, e.g. 250');
    const dueDate = due.trim()
      ? dayjs(due.trim(), ['MM/DD/YYYY', 'M/D/YYYY'], true)
      : null;
    if (due.trim() && (!dueDate || !dueDate.isValid())) {
      return setErr('Due date must be MM/DD/YYYY.');
    }
    const res = await createDuesCycle(
      membership.org.id,
      name.trim(),
      Math.round(dollars * 100),
      dueDate ? dueDate.format('YYYY-MM-DD') : null,
    );
    if (!res.ok) return setErr(res.error);
    setShowNew(false);
    setName('');
    setAmount('');
    setDue('');
    flash(`Billed ${res.created} member${res.created === 1 ? '' : 's'}.`);
    refreshOrg();
    refresh();
  };

  const markPaid = (chargeId: string, amountCents: number) => {
    Alert.alert('Mark as paid', `Record ${money(amountCents)} received outside the app?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Record payment',
        onPress: async () => {
          const res = await recordManualPayment(chargeId, amountCents, 'manual');
          if (!res.ok) return flash(res.error);
          flash('Payment recorded.');
          refreshOrg();
          if (openMember && membership?.org.id) {
            setMemberCharges(
              (await chargesForMember(membership.org.id, openMember.user_id)) as typeof memberCharges,
            );
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <Text style={type.headline} accessibilityRole="header">
          Dues
        </Text>
        <View style={{ width: 64 }} />
      </View>

      {isTreasurer && (
        <View style={s.segmentWrap}>
          <View style={s.segment}>
            {(['mine', 'chapter'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityLabel={t === 'mine' ? 'What I owe' : 'Chapter'}
                accessibilityState={{ selected: tab === t }}
                style={[s.segmentItem, tab === t && s.segmentItemActive]}
              >
                <Text style={[s.segmentText, tab === t && s.segmentTextActive]}>
                  {t === 'mine' ? 'What I owe' : 'Chapter'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {msg && (
          <Card style={[s.card, { backgroundColor: colors.accentSoft }]}>
            <Text style={type.subhead}>{msg}</Text>
          </Card>
        )}

        {/* ---------------- Member view ---------------- */}
        {tab === 'mine' && (
          <>
            <Card style={s.hero}>
              <Text style={type.eyebrow}>Your balance</Text>
              <Text style={s.heroAmount}>{money(outstanding)}</Text>
              <Text style={type.subhead}>
                {outstanding === 0
                  ? "You're all paid up."
                  : `${charges.filter((c) => c.status === 'unpaid' || c.status === 'partial').length} open charge(s)`}
              </Text>
            </Card>

            {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.l }} />}

            {!loading && charges.length === 0 && (
              <Card style={s.card}>
                <Text style={type.headline}>Nothing owed</Text>
                <Text style={type.subhead}>
                  When your chapter bills dues, the charges show up here.
                </Text>
              </Card>
            )}

            {charges.map((c) => {
              const remaining = c.amount_cents - c.paid_cents;
              const open = c.status === 'unpaid' || c.status === 'partial';
              const overdue = open && c.due_date && dayjs(c.due_date).isBefore(dayjs(), 'day');
              return (
                <Card key={c.id} style={s.card}>
                  <View style={s.rowBetween}>
                    <Text style={type.headline}>{c.description ?? 'Charge'}</Text>
                    <Text style={s.amount} accessibilityLabel={`${money(remaining)} remaining`}>
                      {money(remaining)}
                    </Text>
                  </View>
                  <Text style={type.caption}>
                    {c.org_name}
                    {c.due_date ? ` · due ${dayjs(c.due_date).format('MMM D')}` : ''}
                    {c.paid_cents > 0 ? ` · ${money(c.paid_cents)} paid` : ''}
                  </Text>
                  <View style={s.rowBetween}>
                    {c.status === 'paid' ? (
                      <Pill label="Paid ✓" />
                    ) : c.status === 'waived' ? (
                      <Pill label="Waived" />
                    ) : overdue ? (
                      // Red pill + the word "Overdue" — never colour alone.
                      <View style={[s.badge, { backgroundColor: '#FFE8E6' }]}>
                        <Text style={[s.badgeText, { color: colors.danger }]}>Overdue</Text>
                      </View>
                    ) : (
                      <Pill label="Due" />
                    )}
                    {open && (
                      <Pressable
                        style={[s.payBtn, busy === c.id && { opacity: 0.6 }]}
                        disabled={busy === c.id}
                        onPress={() => pay(c)}
                        accessibilityRole="button"
                        accessibilityLabel={`Pay ${money(remaining)} for ${
                          c.description ?? 'this charge'
                        }`}
                        accessibilityState={{ disabled: busy === c.id, busy: busy === c.id }}
                      >
                        {busy === c.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={s.payBtnText}>Pay {money(remaining)}</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                </Card>
              );
            })}
          </>
        )}

        {/* ---------------- Treasurer view ---------------- */}
        {tab === 'chapter' && isTreasurer && (
          <>
            {!stripe.active && (
              <Card style={s.card}>
                <Text style={type.headline}>
                  {stripe.connected ? 'Finish payment setup' : 'Accept card payments'}
                </Text>
                <Text style={[type.subhead, { marginBottom: spacing.m }]}>
                  Connect a Stripe account so members can pay dues in the app. Until then you
                  can still track balances and record cash or Venmo payments by hand.
                </Text>
                <Pressable
                  style={[s.primaryBtn, busy === 'stripe' && { opacity: 0.6 }]}
                  disabled={busy === 'stripe'}
                  onPress={connectStripe}
                  accessibilityRole="button"
                  accessibilityLabel={stripe.connected ? 'Continue setup' : 'Connect Stripe'}
                  accessibilityState={{ disabled: busy === 'stripe', busy: busy === 'stripe' }}
                >
                  <Text style={s.primaryBtnText}>
                    {stripe.connected ? 'Continue setup' : 'Connect Stripe'}
                  </Text>
                </Pressable>
              </Card>
            )}

            <View style={s.statRow}>
              <Card style={[s.card, s.statCard]}>
                <Text style={type.caption}>Outstanding</Text>
                <Text style={s.statAmount}>{money(totalOwed)}</Text>
              </Card>
              <Card style={[s.card, s.statCard]}>
                <Text style={type.caption}>Collected</Text>
                <Text style={[s.statAmount, { color: colors.success }]}>{money(totalPaid)}</Text>
              </Card>
            </View>

            <Pressable
              style={s.primaryBtn}
              onPress={() => setShowNew(true)}
              accessibilityRole="button"
              accessibilityLabel="New dues cycle"
            >
              <Text style={s.primaryBtnText}>+ New dues cycle</Text>
            </Pressable>

            <Text
              style={[type.caption, { marginTop: spacing.l, marginBottom: spacing.s }]}
              accessibilityRole="header"
            >
              WHO OWES
            </Text>
            {members.length === 0 && (
              <Card style={s.card}>
                <Text style={type.subhead}>No active members yet.</Text>
              </Card>
            )}
            {members.map((m) => (
              <Pressable
                key={m.user_id}
                onPress={() => setOpenMember(m)}
                accessibilityRole="button"
                accessibilityLabel={`${m.full_name ?? m.username}, owes ${money(
                  m.owed_cents,
                )}, ${m.paid_cents > 0 ? `${money(m.paid_cents)} paid` : 'nothing paid yet'}`}
                accessibilityHint="Opens their charges"
              >
                <Card style={[s.card, s.memberRow]}>
                  <Avatar
                    initials={(m.full_name ?? m.username ?? '?')
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={type.headline}>{m.full_name ?? m.username}</Text>
                    <Text style={type.caption}>
                      {m.paid_cents > 0 ? `${money(m.paid_cents)} paid` : 'Nothing paid yet'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.amount,
                      m.owed_cents === 0 && { color: colors.success },
                      m.overdue && { color: colors.danger },
                    ]}
                  >
                    {m.owed_cents === 0 ? 'Paid' : money(m.owed_cents)}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {/* New dues cycle */}
      <Sheet visible={showNew} onClose={() => setShowNew(false)} label="New dues cycle">
        <View style={s.sheet}>
          <Text style={[type.title2, { marginBottom: spacing.xs }]} accessibilityRole="header">
            New dues cycle
          </Text>
          <Text style={type.caption}>
            Creates one charge for every active member in your chapter.
          </Text>
          <TextInput
            style={s.input}
            placeholder="Name (e.g. Fall 2026 Dues)"
            placeholderTextColor={colors.inkTertiary}
            value={name}
            onChangeText={setName}
            accessibilityLabel="Dues cycle name"
          />
          <TextInput
            style={s.input}
            placeholder="Amount per member (e.g. 250)"
            placeholderTextColor={colors.inkTertiary}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            accessibilityLabel="Amount per member in dollars"
          />
          <TextInput
            style={s.input}
            placeholder="Due date MM/DD/YYYY (optional)"
            placeholderTextColor={colors.inkTertiary}
            keyboardType="numbers-and-punctuation"
            value={due}
            onChangeText={setDue}
            accessibilityLabel="Due date, optional"
            accessibilityHint="Format month slash day slash year"
          />
          {err && (
            <Text style={s.err} accessibilityLiveRegion="assertive" accessibilityRole="alert">
              {err}
            </Text>
          )}
          <View style={s.sheetBtns}>
            <Pressable
              style={[s.mBtn, s.mBtnGhost]}
              onPress={() => setShowNew(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[s.mBtnText, { color: colors.ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={s.mBtn}
              onPress={submitCycle}
              accessibilityRole="button"
              accessibilityLabel="Bill members"
            >
              <Text style={s.mBtnText}>Bill members</Text>
            </Pressable>
          </View>
        </View>
      </Sheet>

      {/* Member drill-down */}
      <Sheet
        visible={!!openMember}
        onClose={() => setOpenMember(null)}
        label={openMember?.full_name ?? openMember?.username ?? undefined}
      >
        <View style={s.sheet}>
          <Text style={[type.title2, { marginBottom: spacing.xs }]} accessibilityRole="header">
            {openMember?.full_name ?? openMember?.username}
          </Text>
          <Text style={type.caption}>
            Owes {money(openMember?.owed_cents ?? 0)} · paid {money(openMember?.paid_cents ?? 0)}
          </Text>
          {memberCharges.map((c) => (
            <View key={c.id} style={s.chargeRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{c.description ?? 'Charge'}</Text>
                <Text style={type.caption}>
                  {money(c.amount_cents)}
                  {c.due_date ? ` · due ${dayjs(c.due_date).format('MMM D')}` : ''} · {c.status}
                </Text>
              </View>
              {(c.status === 'unpaid' || c.status === 'partial') && (
                <Pressable
                  onPress={() => markPaid(c.id, c.amount_cents)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark ${c.description ?? 'charge'} of ${money(
                    c.amount_cents,
                  )} as paid`}
                >
                  <Text style={s.link}>Mark paid</Text>
                </Pressable>
              )}
            </View>
          ))}
          {memberCharges.length === 0 && <Text style={type.subhead}>No charges.</Text>}
          <Pressable
            style={s.doneBtn}
            onPress={() => setOpenMember(null)}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={s.mBtnText}>Done</Text>
          </Pressable>
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
  segmentWrap: { paddingHorizontal: spacing.l, paddingTop: spacing.m },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: radius.control,
    padding: 3,
  },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.control - 3 },
  segmentItemActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 15, color: colors.inkSecondary, fontWeight: '500' },
  segmentTextActive: { color: colors.ink, fontWeight: '600' },
  scroll: { padding: spacing.l, paddingBottom: spacing.xxl },
  hero: { marginBottom: spacing.m, gap: 2 },
  heroAmount: { fontSize: 40, fontWeight: '700', color: colors.ink, marginVertical: 2 },
  card: { marginBottom: spacing.m, gap: spacing.s },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 17, fontWeight: '700', color: colors.ink },
  badge: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  badgeText: { fontWeight: '600', fontSize: 14 },
  payBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
    minWidth: 110,
    alignItems: 'center',
  },
  payBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  statRow: { flexDirection: 'row', gap: spacing.m },
  statCard: { flex: 1, gap: 2 },
  statAmount: { fontSize: 22, fontWeight: '700', color: colors.ink },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  sheet: {
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
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    marginTop: spacing.xs,
  },
  link: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  err: { color: colors.danger, fontSize: 14 },
  sheetBtns: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.m },
  mBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  mBtnGhost: { backgroundColor: colors.card },
  mBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.m,
  },
});
