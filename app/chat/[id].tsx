import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '../../components/ui';
import { chats, messagesByChat } from '../../lib/mock';
import { colors, radius, spacing, type } from '../../lib/theme';

/**
 * Chat thread. Demo state now; wire to `messages` + Supabase Realtime
 * (`postgres_changes` on chat_id) when the backend is connected.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chat = chats.find((c) => c.id === id);
  const [messages, setMessages] = useState(messagesByChat[id ?? ''] ?? []);
  const [draft, setDraft] = useState('');

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setMessages((m) => [
      ...m,
      { id: String(Date.now()), from: 'You', mine: true, body, at: 'now' },
    ]);
    setDraft('');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Avatar initials={chat?.initials ?? '?'} size={32} />
          <Text style={type.headline}>{chat?.name ?? 'Chat'}</Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={[s.bubbleRow, item.mine && s.bubbleRowMine]}>
              <View style={[s.bubble, item.mine ? s.bubbleMine : s.bubbleTheirs]}>
                {!item.mine && <Text style={s.sender}>{item.from}</Text>}
                <Text style={[type.body, item.mine && { color: '#fff' }]}>{item.body}</Text>
                <Text style={[s.time, item.mine && { color: '#D9D9FB' }]}>{item.at}</Text>
              </View>
            </View>
          )}
        />
        <View style={s.composer}>
          <TextInput
            style={s.input}
            placeholder="Message"
            placeholderTextColor={colors.inkTertiary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable style={s.sendBtn} onPress={send}>
            <Text style={s.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  back: { color: colors.accent, fontSize: 17, fontWeight: '600', width: 64 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s },
  headerSpacer: { width: 64 },
  list: { padding: spacing.l, gap: spacing.s },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.card - 4,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    gap: 2,
  },
  bubbleTheirs: { backgroundColor: colors.card },
  bubbleMine: { backgroundColor: colors.accent },
  sender: { fontSize: 13, fontWeight: '700', color: colors.accent },
  time: { fontSize: 11, color: colors.inkTertiary, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.m,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  input: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.l,
    paddingVertical: 10,
    fontSize: 17,
    color: colors.ink,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
