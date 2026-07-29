import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Card, Pill, ScreenTitle } from '../../components/ui';
import { useSession } from '../../lib/useSession';
import { usePosts, PostRow } from '../../lib/data';
import { posts as mockPosts } from '../../lib/mock';
import { colors, radius, spacing, type } from '../../lib/theme';

dayjs.extend(relativeTime);

export default function FeedScreen() {
  const { demoMode, session, profile } = useSession();
  const userId = session?.user.id;
  const isStudent = demoMode || profile?.account_type === 'student';
  const { posts: livePosts, loading, createPost, vote } = usePosts(profile?.school_id, userId);

  const [showNew, setShowNew] = useState(false);
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [demoVotes, setDemoVotes] = useState<Record<string, 1 | -1 | 0>>({});

  const posts: PostRow[] = demoMode
    ? mockPosts.map((p) => ({
        id: p.id,
        body: p.body,
        score: p.up - p.down + (demoVotes[p.id] ?? 0),
        created_at: new Date().toISOString(),
        myVote: demoVotes[p.id] ?? 0,
      }))
    : livePosts;

  const submitNew = async () => {
    setErr(null);
    if (body.trim().length < 3) return setErr('Write something first.');
    if (demoMode) {
      setShowNew(false);
      setBody('');
      return;
    }
    const res = await createPost(body);
    if (!res.ok) return setErr(res.error);
    setShowNew(false);
    setBody('');
  };

  const doVote = (id: string, dir: 1 | -1) => {
    if (demoMode) {
      setDemoVotes((v) => ({ ...v, [id]: v[id] === dir ? 0 : dir }));
      return;
    }
    vote(id, dir);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.container}>
        <View style={s.titleRow}>
          <ScreenTitle>Feed</ScreenTitle>
          {isStudent && (
            <Pressable style={s.addBtn} onPress={() => setShowNew(true)}>
              <Text style={s.addBtnText}>+ Post</Text>
            </Pressable>
          )}
        </View>
        <View style={s.filterRow}>
          <Pill label="Campus" />
        </View>

        {!isStudent && (
          <Card style={s.empty}>
            <Text style={type.headline}>Students only</Text>
            <Text style={type.subhead}>
              The campus feed needs a verified school email. Sign in with your .edu address to
              unlock it.
            </Text>
          </Card>
        )}
        {isStudent && !loading && posts.length === 0 && (
          <Card style={s.empty}>
            <Text style={type.headline}>Quiet out here</Text>
            <Text style={type.subhead}>Be the first to post something on your campus.</Text>
          </Card>
        )}

        <FlatList
          data={isStudent ? posts : []}
          keyExtractor={(p) => p.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card style={s.post}>
              <Text style={type.caption}>
                anonymous · {demoMode ? '2h' : dayjs(item.created_at).fromNow()}
              </Text>
              <Text style={[type.body, s.postBody]}>{item.body}</Text>
              <View style={s.voteRow}>
                <Pressable
                  onPress={() => doVote(item.id, 1)}
                  style={[s.voteBtn, item.myVote === 1 && s.voteBtnUp]}
                >
                  <Text style={[s.voteText, item.myVote === 1 && { color: '#fff' }]}>▲</Text>
                </Pressable>
                <Text style={s.scoreText}>{item.score}</Text>
                <Pressable
                  onPress={() => doVote(item.id, -1)}
                  style={[s.voteBtn, item.myVote === -1 && s.voteBtnDown]}
                >
                  <Text style={[s.voteText, item.myVote === -1 && { color: '#fff' }]}>▼</Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      </View>

      <Sheet visible={showNew} onClose={() => setShowNew(false)}>
        <View style={s.modal}>
            <Text style={[type.title2, { marginBottom: spacing.m }]}>New post</Text>
            <Text style={type.caption}>Posts are anonymous to other students.</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="What's happening on campus?"
              placeholderTextColor={colors.inkTertiary}
              value={body}
              onChangeText={setBody}
              multiline
            />
            {err && <Text style={s.err}>{err}</Text>}
            <View style={s.modalBtns}>
              <Pressable style={[s.mBtn, s.mBtnGhost]} onPress={() => setShowNew(false)}>
                <Text style={[s.mBtnText, { color: colors.ink }]}>Cancel</Text>
              </Pressable>
              <Pressable style={s.mBtn} onPress={submitNew}>
                <Text style={s.mBtnText}>Post</Text>
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
    marginTop: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  filterRow: { marginBottom: spacing.l },
  empty: { gap: 4, marginBottom: spacing.m },
  post: { marginBottom: spacing.m, gap: spacing.s },
  postBody: { lineHeight: 23 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, marginTop: spacing.xs },
  voteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
  },
  voteBtnUp: { backgroundColor: colors.accent },
  voteBtnDown: { backgroundColor: colors.inkSecondary },
  voteText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  scoreText: { fontSize: 15, fontWeight: '700', color: colors.ink, minWidth: 28, textAlign: 'center' },
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
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
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
