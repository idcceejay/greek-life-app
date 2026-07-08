import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing, type } from '../lib/theme';

dayjs.extend(customParseFormat);

export default function OnboardingScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const uname = username.trim().toLowerCase();
    if (uname.length < 3) return setError('Username needs at least 3 characters.');
    if (fullName.trim().length < 2) return setError('Enter your name.');
    const bd = dayjs(birthday.trim(), ['MM/DD/YYYY', 'M/D/YYYY'], true);
    if (!bd.isValid()) return setError('Birthday must be MM/DD/YYYY.');
    if (bd.isAfter(dayjs().subtract(16, 'year'))) return setError('You must be at least 16.');

    setBusy(true);
    const { data, error: err } = await supabase.rpc('ensure_profile', {
      p_username: uname,
      p_full_name: fullName.trim(),
      p_birthday: bd.format('YYYY-MM-DD'),
    });
    setBusy(false);
    if (err) {
      setError(err.message.includes('unique') ? 'That username is taken.' : err.message);
      return;
    }
    if (data && (data as { ok: boolean }).ok === false) {
      setError('Could not create profile. Try again.');
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={type.eyebrow}>One last step</Text>
          <Text style={[type.largeTitle, s.title]}>Create your profile</Text>

          <Text style={s.label}>Username</Text>
          <TextInput
            style={s.input}
            placeholder="cr_sigma"
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <Text style={s.label}>Full name</Text>
          <TextInput
            style={s.input}
            placeholder="Ceejay Raut"
            placeholderTextColor={colors.inkTertiary}
            value={fullName}
            onChangeText={setFullName}
          />
          <Text style={s.label}>Birthday</Text>
          <TextInput
            style={s.input}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colors.inkTertiary}
            keyboardType="numbers-and-punctuation"
            value={birthday}
            onChangeText={setBirthday}
          />
          <Text style={s.hint}>
            Your birthday shows on your chapters' calendars (year hidden).
          </Text>

          {error && <Text style={s.error}>{error}</Text>}

          <Pressable style={[s.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Done</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  body: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.s },
  title: { marginBottom: spacing.l },
  label: { ...type.caption, marginTop: spacing.s },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.ink,
  },
  hint: { ...type.caption, color: colors.inkTertiary, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.s },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.l,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
