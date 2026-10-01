import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Avatar, Card, ScreenTitle } from '../../components/ui';
import { useSession } from '../../lib/useSession';
import { useMyOrg, useChats, createGroupChat, joinChatWithCode } from '../../lib/data';
import { colors, radius, spacing, type } from '../../lib/theme';

dayjs.extend(relativeTime);

function initialsOf(name: string | null) {
  if (!name) return 'DM';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ChatsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { membership } = useMyOrg(userId);
  const { chats, loading, refresh } = useChats(userId);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [code, setCode] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const data = chats;

  const filtered = data.filter((c) =>
    (c.name ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  const submitNew = async () => {
    setErr(null);
    if (!userId) return;
    if (name.trim().length < 2) return setErr('Give the group a name.');
    const res = await createGroupChat(name.trim(), membership?.org.id ?? null);
    if (!res.ok) return setErr(res.error);
    setShowNew(false);
    setName('');
    refresh();
    router.push(`/chat/${res.chatId}`);
  };

  const submitJoin = async () => {
    setJoinErr(null);
    if (code.trim().length < 4) return setJoinErr('Paste the invite code.');
    const res = await joinChatWithCode(code);
    if (!res.ok)
      return setJoinErr(
        res.error === 'invalid_or_expired' ? 'That code is invalid or expired.' : res.error,
      );
    setShowJoin(false);
    setCode('');
    refresh();
    router.push(`/chat/${res.chatId}`);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.container}>
        <View style={s.titleRow}>
          <ScreenTitle>Chats</ScreenTitle>
          <View style={s.headerBtns}>
              <Pressable
                style={s.joinBtn}
                onPress={() => setShowJoin(true)}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Join a group with an invite code"
              >
                <Text style={s.joinBtnText}>Join code</Text>
              </Pressable>
            <Pressable
              style={s.addBtn}
              onPress={() => setShowNew(true)}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="button"
              accessibilityLabel="New group"
            >
              <Text style={s.addBtnText}>+ Group</Text>
            </Pressable>
          </View>
        </View>
        <TextInput
          style={s.search}
          placeholder="Search"
          placeholderTextColor={colors.inkTertiary}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Search chats"
        />
        {!loading && filtered.length === 0 && (
          <Card style={s.empty}>
            <Text style={type.headline}>No chats yet</Text>
            <Text style={type.subhead}>
              Tap “+ Group” to start one. Chapter groups are created automatically when you create
              or join an organization.
            </Text>
          </Card>
        )}
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => (
            <Pressable
              style={s.row}
              onPress={() => router.push(`/chat/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name ?? 'Direct message'}. ${
                item.lastMessage ?? 'No messages yet'
              }${item.lastAt ? `, ${dayjs(item.lastAt).fromNow()}` : ''}`}
            >
              <Avatar initials={initialsOf(item.name)} />
              <View style={s.rowBody}>
                <Text style={type.headline}>{item.name ?? 'Direct message'}</Text>
                <Text style={type.subhead} numberOfLines={1}>
                  {item.lastMessage ?? 'No messages yet'}
                </Text>
              </View>
              <View style={s.rowMeta}>
                <Text style={type.caption}>
                  {item.lastAt ? dayjs(item.lastAt).fromNow() : ''}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>

      <Sheet visible={showNew} onClose={() => setShowNew(false)} label="New group">
        <View style={s.modal}>
            <Text style={[type.title2, { marginBottom: spacing.m }]} accessibilityRole="header">
              New group
            </Text>
            <TextInput
              style={s.input}
              placeholder="Group name (e.g. Rush Committee)"
              placeholderTextColor={colors.inkTertiary}
              value={name}
              onChangeText={setName}
              accessibilityLabel="Group name"
            />
            {err && (
              <Text style={s.err} accessibilityLiveRegion="assertive" accessibilityRole="alert">
                {err}
              </Text>
            )}
            <View style={s.modalBtns}>
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
                onPress={submitNew}
                accessibilityRole="button"
                accessibilityLabel="Create group"
              >
                <Text style={s.mBtnText}>Create</Text>
              </Pressable>
          </View>
        </View>
      </Sheet>

      <Sheet visible={showJoin} onClose={() => setShowJoin(false)} label="Join a group">
        <View style={s.modal}>
          <Text style={[type.title2, { marginBottom: spacing.xs }]} accessibilityRole="header">
            Join a group
          </Text>
          <Text style={type.caption}>Paste the invite code someone shared with you.</Text>
          <TextInput
            style={s.input}
            placeholder="Invite code"
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="none"
            value={code}
            onChangeText={setCode}
            accessibilityLabel="Invite code"
          />
          {joinErr && (
            <Text style={s.err} accessibilityLiveRegion="assertive" accessibilityRole="alert">
              {joinErr}
            </Text>
          )}
          <View style={s.modalBtns}>
            <Pressable
              style={[s.mBtn, s.mBtnGhost]}
              onPress={() => setShowJoin(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[s.mBtnText, { color: colors.ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={s.mBtn}
              onPress={submitJoin}
              accessibilityRole="button"
              accessibilityLabel="Join group"
            >
              <Text style={s.mBtnText}>Join</Text>
            </Pressable>
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, padding: spacing.l },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  headerBtns: { flexDirection: 'row', gap: spacing.s, alignItems: 'center', marginTop: 6 },
  joinBtn: {
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinBtnText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  search: {
    backgroundColor: colors.fill,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 10,
    fontSize: 17,
    marginBottom: spacing.l,
    color: colors.ink,
  },
  empty: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.m },
  rowBody: { flex: 1, marginLeft: spacing.m, gap: 2 },
  rowMeta: { alignItems: 'flex-end', gap: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  sep: { height: 1, backgroundColor: colors.separator, marginLeft: 60 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.m,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
  },
  err: { color: colors.danger, fontSize: 14 },
  modalBtns: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.s },
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
