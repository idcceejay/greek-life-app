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
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useSession } from '../../lib/useSession';
import {
  useMessages,
  MessageRow,
  createChatInvite,
  searchUsers,
  addChatMember,
  reportContent,
  blockUser,
  REPORT_REASONS,
  ReportReason,
  UserHit,
} from '../../lib/data';
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
  const [showInvite, setShowInvite] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<UserHit[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [reportOn, setReportOn] = useState<MessageRow | null>(null);
  const [modMsg, setModMsg] = useState<string | null>(null);

  const submitReport = async (reason: ReportReason) => {
    if (!reportOn) return;
    const res = await reportContent('message', reportOn.id, reason);
    setReportOn(null);
    setModMsg(res.ok ? 'Reported. Our team reviews within 24 hours.' : res.error);
    setTimeout(() => setModMsg(null), 4000);
  };

  const doBlockSender = async () => {
    if (!reportOn?.sender_id) return;
    const res = await blockUser(reportOn.sender_id);
    setReportOn(null);
    setModMsg(res.ok ? 'Blocked.' : res.error);
    setTimeout(() => setModMsg(null), 4000);
  };

  const openInvite = async () => {
    setInviteErr(null);
    setCopied(false);
    setShowInvite(true);
    if (!id) return;
    const res = await createChatInvite(id);
    if (res.ok) setToken(res.token);
    else
      setInviteErr(
        res.error === 'admins_only'
          ? 'Only group admins can create invite codes.'
          : res.error,
      );
  };

  const runSearch = async (text: string) => {
    setQ(text);
    setHits(await searchUsers(text));
  };

  const addMember = async (u: UserHit) => {
    if (!id || !u.username) return;
    const res = await addChatMember(id, u.username);
    if (res.ok) setAdded((a) => [...a, u.username!]);
    else
      setInviteErr(
        res.error === 'admins_only'
          ? 'Only group admins can add members.'
          : res.error === 'not_same_campus'
            ? 'That person is not on your campus.'
            : res.error,
      );
  };

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
        {demoMode ? (
          <View style={s.headerSpacer} />
        ) : (
          <Pressable onPress={openInvite} hitSlop={10} style={s.headerSpacer}>
            <Text style={s.inviteLink}>Invite</Text>
          </Pressable>
        )}
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
            <Pressable
              style={[s.bubbleRow, item.mine && s.bubbleRowMine]}
              onLongPress={() => !item.mine && !demoMode && setReportOn(item)}
              delayLongPress={400}
            >
              <View style={[s.bubble, item.mine ? s.bubbleMine : s.bubbleTheirs]}>
                {!item.mine && item.sender_name && <Text style={s.sender}>{item.sender_name}</Text>}
                <Text style={[type.body, item.mine && { color: '#fff' }]}>{item.body}</Text>
                <Text style={[s.time, item.mine && { color: '#D9D9FB' }]}>
                  {demoMode ? 'now' : dayjs(item.created_at).format('h:mm A')}
                </Text>
              </View>
            </Pressable>
          )}
        />
        {modMsg && <Text style={s.modBanner}>{modMsg}</Text>}
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

      {/* Invite / add members */}
      <Sheet visible={showInvite} onClose={() => setShowInvite(false)}>
        <View style={s.sheet}>
          <Text style={[type.title2, { marginBottom: spacing.xs }]}>Add people</Text>

          <Text style={type.caption}>Share this invite code</Text>
          <Pressable
            style={s.codeBox}
            onPress={async () => {
              if (!token) return;
              await Clipboard.setStringAsync(token);
              setCopied(true);
            }}
          >
            <Text style={s.codeText}>{token ?? '…'}</Text>
            <Text style={s.copyHint}>{copied ? 'Copied ✓' : 'Tap to copy'}</Text>
          </Pressable>
          <Text style={type.caption}>
            They tap “Join code” on the Chats tab and paste it. Expires in 30 days.
          </Text>

          <Text style={[type.caption, { marginTop: spacing.m }]}>Or add by username</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search name or username"
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="none"
            value={q}
            onChangeText={runSearch}
          />
          {hits.map((u) => (
            <Pressable key={u.id} style={s.hitRow} onPress={() => addMember(u)}>
              <View>
                <Text style={type.headline}>{u.full_name ?? u.username}</Text>
                <Text style={type.caption}>@{u.username}</Text>
              </View>
              <Text style={s.addLink}>
                {u.username && added.includes(u.username) ? 'Added ✓' : 'Add'}
              </Text>
            </Pressable>
          ))}
          {q.trim().length >= 2 && hits.length === 0 && (
            <Text style={type.subhead}>No one found on your campus.</Text>
          )}

          {inviteErr && <Text style={s.err}>{inviteErr}</Text>}
          <Pressable style={s.doneBtn} onPress={() => setShowInvite(false)}>
            <Text style={s.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </Sheet>

      {/* Report / block a message */}
      <Sheet visible={!!reportOn} onClose={() => setReportOn(null)}>
        <View style={s.sheet}>
          <Text style={[type.title2, { marginBottom: spacing.xs }]}>Report message</Text>
          <Text style={type.caption}>Reviewed within 24 hours.</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable key={r.key} style={s.hitRow} onPress={() => submitReport(r.key)}>
              <Text style={type.body}>{r.label}</Text>
              <Text style={s.addLink}>›</Text>
            </Pressable>
          ))}
          <Pressable style={s.hitRow} onPress={doBlockSender}>
            <Text style={[type.body, { color: colors.danger, fontWeight: '600' }]}>
              Block {reportOn?.sender_name ?? 'this person'}
            </Text>
          </Pressable>
          <Pressable style={s.doneBtn} onPress={() => setReportOn(null)}>
            <Text style={s.doneBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </Sheet>
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
  headerSpacer: { width: 64, alignItems: 'flex-end' },
  inviteLink: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.s,
  },
  codeBox: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    padding: spacing.l,
    alignItems: 'center',
    gap: 4,
  },
  codeText: { fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: 1 },
  copyHint: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
  },
  hitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  addLink: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  modBanner: {
    ...type.caption,
    textAlign: 'center',
    paddingVertical: spacing.s,
    backgroundColor: colors.accentSoft,
  },
  err: { color: colors.danger, fontSize: 14 },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
