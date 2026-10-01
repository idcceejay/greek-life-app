import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Avatar, BackHeader, Card } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useSession } from '../lib/useSession';
import {
  listBlockedUsers,
  unblockUser,
  setGhostMode,
  updateProfile,
  deleteMyAccount,
  signOut,
  UserHit,
} from '../lib/data';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, radius, spacing, type } from '../lib/theme';

const SUPPORT_EMAIL = 'support@rallyapp.com'; // TODO: real support inbox before submission
const PRIVACY_URL = 'https://rallyapp.com/privacy'; // TODO: publish before submission

export default function SettingsScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile } = useSession();

  const [name, setName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [ghost, setGhost] = useState(false);
  const [blocked, setBlocked] = useState<UserHit[]>([]);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? '');
    setUsername(profile?.username ?? '');
  }, [profile?.full_name, profile?.username]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    listBlockedUsers().then(setBlocked);
    supabase
      .from('location_settings')
      .select('ghost_mode')
      .maybeSingle()
      .then(({ data }) => setGhost(!!(data as { ghost_mode: boolean } | null)?.ghost_mode));
  }, []);

  const saveProfile = async () => {
    setErr(null);
    const res = await updateProfile({
      full_name: name.trim(),
      username: username.trim().toLowerCase(),
    });
    if (!res.ok) {
      setErr(res.error.includes('unique') ? 'That username is taken.' : res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refreshProfile();
  };

  const toggleGhost = async (v: boolean) => {
    setGhost(v);
    await setGhostMode(v);
  };

  const doUnblock = async (u: UserHit) => {
    await unblockUser(u.id);
    setBlocked(await listBlockedUsers());
  };

  const doDelete = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    const res = await deleteMyAccount();
    setDeleting(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setShowDelete(false);
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <BackHeader title="Settings" />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Profile */}
        <Card style={s.card}>
          <View style={s.profileRow}>
            <Avatar
              initials={(profile?.full_name ?? profile?.username ?? 'ME')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
              size={52}
            />
            <View style={{ flex: 1 }}>
              <Text style={type.headline}>{profile?.full_name ?? 'Your profile'}</Text>
              <Text style={type.caption}>{session?.user.email}</Text>
              <Text style={type.caption}>
                {profile?.account_type === 'student' ? 'Verified student' : 'Alumni account'}
              </Text>
            </View>
          </View>
          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            accessibilityLabel="Full name"
          />
          <Text style={s.label}>Username</Text>
          <TextInput
            style={s.input}
            value={username}
            autoCapitalize="none"
            onChangeText={setUsername}
            accessibilityLabel="Username"
          />
          {err && (
            <Text style={s.err} accessibilityLiveRegion="assertive" accessibilityRole="alert">
              {err}
            </Text>
          )}
          <Pressable
            style={s.saveBtn}
            onPress={saveProfile}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Saved' : 'Save changes'}
          >
            <Text style={s.saveBtnText} accessibilityLiveRegion="polite">
              {saved ? 'Saved ✓' : 'Save changes'}
            </Text>
          </Pressable>
        </Card>

        {/* Privacy */}
        <Card style={s.card}>
          <Text style={type.headline} accessibilityRole="header">
            Privacy
          </Text>
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>Ghost mode</Text>
              <Text style={type.caption}>Hide your location from everyone, instantly.</Text>
            </View>
            <Switch
              value={ghost}
              onValueChange={toggleGhost}
              trackColor={{ true: colors.accent }}
              accessibilityLabel="Ghost mode"
              accessibilityHint="Hides your location from everyone"
            />
          </View>
          <Text style={type.caption}>
            Location is shared only while the app is open, only with members of your organization,
            and pings older than 90 days are deleted automatically.
          </Text>
        </Card>

        {/* Blocked users */}
        <Card style={s.card}>
          <Text style={type.headline} accessibilityRole="header">
            Blocked people
          </Text>
          {blocked.length === 0 && (
            <Text style={type.subhead}>You haven't blocked anyone.</Text>
          )}
          {blocked.map((u) => (
            <View key={u.id} style={s.blockedRow}>
              <Text style={type.body}>{u.full_name ?? u.username}</Text>
              <Pressable
                onPress={() => doUnblock(u)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${u.full_name ?? u.username}`}
              >
                <Text style={s.link}>Unblock</Text>
              </Pressable>
            </View>
          ))}
          <Text style={type.caption}>
            Blocked people can't see your posts or messages, and you won't see theirs.
          </Text>
        </Card>

        {/* Support & legal */}
        <Card style={s.card}>
          <Text style={type.headline} accessibilityRole="header">
            Support
          </Text>
          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            hitSlop={{ top: 12, bottom: 12 }}
            accessibilityRole="link"
            accessibilityLabel="Contact support"
            accessibilityHint="Opens your email app"
          >
            <Text style={s.link}>Contact support</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(PRIVACY_URL)}
            hitSlop={{ top: 12, bottom: 12 }}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
            accessibilityHint="Opens in your browser"
          >
            <Text style={s.link}>Privacy Policy</Text>
          </Pressable>
          <Text style={type.caption}>
            We review reported content within 24 hours and remove anything that violates our
            community rules.
          </Text>
        </Card>

        {/* Account */}
        <Card style={s.card}>
          <Text style={type.headline} accessibilityRole="header">
            Account
          </Text>
          <Pressable
            onPress={() =>
              Alert.alert('Sign out?', '', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
              ])
            }
            hitSlop={{ top: 12, bottom: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={s.link}>Sign out</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowDelete(true)}
            hitSlop={{ top: 12, bottom: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            accessibilityHint="Permanently removes your profile and content"
          >
            <Text style={[s.link, { color: colors.danger }]}>Delete my account</Text>
          </Pressable>
        </Card>
      </ScrollView>

      {/* Delete account confirmation */}
      <Sheet visible={showDelete} onClose={() => setShowDelete(false)} label="Delete account">
        <View style={s.sheet}>
          <Text style={[type.title2, { color: colors.danger }]} accessibilityRole="header">
            Delete account
          </Text>
          <Text style={type.subhead}>
            This permanently deletes your profile, memberships, posts, and messages. It cannot be
            undone.
          </Text>
          <Text style={s.label}>Type DELETE to confirm</Text>
          <TextInput
            style={s.input}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            placeholder="DELETE"
            placeholderTextColor={colors.inkTertiary}
            accessibilityLabel="Confirmation"
            accessibilityHint="Type the word DELETE in capitals to enable the delete button"
          />
          <View style={s.sheetBtns}>
            <Pressable
              style={[s.mBtn, s.mBtnGhost]}
              onPress={() => setShowDelete(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[s.mBtnText, { color: colors.ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                s.mBtn,
                { backgroundColor: colors.danger },
                (confirmText.trim().toUpperCase() !== 'DELETE' || deleting) && { opacity: 0.5 },
              ]}
              disabled={confirmText.trim().toUpperCase() !== 'DELETE' || deleting}
              onPress={doDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete forever"
              // Dimming alone doesn't tell VoiceOver the button is unavailable.
              accessibilityHint={
                confirmText.trim().toUpperCase() !== 'DELETE'
                  ? 'Type DELETE in the field above to enable this'
                  : undefined
              }
              accessibilityState={{
                disabled: confirmText.trim().toUpperCase() !== 'DELETE' || deleting,
                busy: deleting,
              }}
            >
              <Text style={s.mBtnText}>{deleting ? 'Deleting…' : 'Delete forever'}</Text>
            </Pressable>
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.l, gap: spacing.m, paddingBottom: spacing.xxl },
  card: { gap: spacing.s },
  profileRow: { flexDirection: 'row', gap: spacing.m, alignItems: 'center', marginBottom: spacing.s },
  label: { ...type.caption, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.xs },
  blockedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.s,
  },
  link: { color: colors.accent, fontSize: 16, fontWeight: '600', paddingVertical: 6 },
  err: { color: colors.danger, fontSize: 14 },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.s,
  },
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
});
