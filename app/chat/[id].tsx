import React, { useEffect, useRef, useState } from 'react';
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
import dayjs from 'dayjs';
import { Avatar } from '../../components/ui';
import { useSession } from '../../lib/useSession';
import { useMessages, MessageRow } from '../../lib/data';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { chats as mockChats, messagesByChat } from '../../lib/mock';
import { colors, radius, spacing, type } from '../../lib/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { demoMode, session } = useSession();
  const userId = session?.user.id;
  const listRef = useRef<FlatList>(null);

  const [chatName, setChatName] = useState<string>('Chat');
  const { messages: liveMessages, send } = useMessages(demoMode ? undefined : id, userId);
  const [demoMessages, setDemoMessages] = useState(
    demoMode ? (messagesByChat[id ?? ''] ?? []) : [],
  );
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (demoMode) {
      setChatName(mockChats.find((c) => c.id === id)?.name ?? 'Chat');
      return;
    }
    if (!supabaseConfigured || !id) return;
    supabase
      .from('chats')
      .select('name, type')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { name: string | null; type: string } | null;
        setChatName(row?.name ?? (row?.type === 'dm' ? 'Direct message' : 'Chat'));
      });
  }, [id, demoMode]);

  const messages: (MessageRow & { mine: boolean })[] = demoMode
    ? demoMessages.map((m) => ({
        id: m.id,
        chat_id: id ?? '',
        sender_id: m.mine ? 'me' : 'them',
        body: m.body,
        created_at: new Date().toISOString(),
        sender_name: m.from,
        mine: m.mine,
      }))
    : liveMessages.map((m) => ({ ...m, mine: m.sender_id === userId }));

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    if (demoMode) {
      setDemoMessages((m) => [
        ...m,
        { id: String(Date.now()), from: 'You', mine: true, body, at: 'now' },
      ]);
      return;
    }
    await send(body);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Avatar
            initials={chatName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
            size={32}
          />
          <Text style={type.headline}>{chatName}</Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={[type.subhead, { textAlign: 'center', marginTop: spacing.xl }]}>
              No messages yet — say hi 👋
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[s.bubbleRow, item.mine && s.bubbleRowMine]}>
              <View style={[s.bubble, item.mine ? s.bubbleMine : s.bubbleTheirs]}>
                {!item.mine && item.sender_name && <Text style={s.sender}>{item.sender_name}</Text>}
                <Text style={[type.body, item.mine && { color: '#fff' }]}>{item.body}</Text>
                <Text style={[s.time, item.mine && { color: '#D9D9FB' }]}>
                  {demoMode ? 'now' : dayjs(item.created_at).format('h:mm A')}
                </Text>
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
            onSubmitEditing={submit}
            returnKeyType="send"
          />
          <Pressable style={s.sendBtn} onPress={submit}>
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  headerSpacer: { width: 64 },
  list: { padding: spacing.l, gap: spacing.s, flexGrow: 1 },
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
