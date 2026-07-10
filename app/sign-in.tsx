import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing, type } from '../lib/theme';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const addr = email.trim().toLowerCase();
    if (!addr.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setStage('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (err) setError(err.message);
    else router.replace('/onboarding');
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.body}>
          <Text style={type.eyebrow}>Greek Life</Text>
          <Text style={[type.largeTitle, s.title]}>
            {stage === 'email' ? 'Sign in' : 'Check your email'}
          </Text>
          <Text style={[type.subhead, s.sub]}>
            {stage === 'email'
              ? 'Use your school .edu email to unlock full access. Codes arrive by email — no passwords.'
              : `We sent a sign-in code to ${email.trim()}.`}
          </Text>

          {stage === 'email' ? (
            <TextInput
              style={s.input}
              placeholder="you@school.edu"
              placeholderTextColor={colors.inkTertiary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={sendCode}
            />
          ) : (
            <TextInput
              style={[s.input, s.codeInput]}
              placeholder="123456"
              placeholderTextColor={colors.inkTertiary}
              keyboardType="number-pad"
              maxLength={10}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={verify}
            />
          )}

          {error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={[s.button, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={stage === 'email' ? sendCode : verify}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>{stage === 'email' ? 'Send code' : 'Verify'}</Text>
            )}
          </Pressable>

          {stage === 'code' && (
            <Pressable onPress={() => setStage('email')} hitSlop={8}>
              <Text style={s.link}>Use a different email</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  body: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.m },
  title: { marginTop: spacing.xs },
  sub: { marginBottom: spacing.l, lineHeight: 21 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.ink,
  },
  codeInput: { textAlign: 'center', fontSize: 28, letterSpacing: 8, fontWeight: '700' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { color: colors.accent, fontSize: 15, fontWeight: '500', textAlign: 'center', marginTop: spacing.m },
  error: { color: colors.danger, fontSize: 14 },
});
