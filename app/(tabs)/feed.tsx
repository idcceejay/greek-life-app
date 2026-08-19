import React, { useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Sheet } from '../../components/Sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Card, Pill, ScreenTitle } from '../../components/ui';
import { useSession } from '../../lib/useSession';
import {
  usePosts,
  PostRow,
  reportContent,
  blockPostAuthor,
  REPORT_REASONS,
  ReportReason,
} from '../../lib/data';
import { colors, radius, spacing, type } from '../../lib/theme';

dayjs.extend(relativeTime);

export default function FeedScreen() {
  const { session, profile } = useSession();
  const userId = session?.user.id;
  const isStudent = profile?.account_type === 'student';
  const { posts: livePosts, loading, createPost, vote, refresh } = usePosts(
    profile?.school_id,
    userId,
  );

  const [showNew, setShowNew] = useState(false);
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [reportOn, setReportOn] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  /**
   * The toast is the only confirmation these actions give, and it self-dismisses
   * after 5s — so it has to be spoken, not just drawn (WCAG SC 4.1.3).
   */
  const flash = (msg: string) => {
    setReportMsg(msg);
    AccessibilityInfo.announceForAccessibility(msg);
    setTimeout(() => setReportMsg(null), 5000);
  };

  const submitReport = async (reason: ReportReason) => {
    if (!reportOn) return;
    const res = await reportContent('post', reportOn, reason);
    setReportOn(null);
    flash(
      res.ok
        ? 'Thanks — that post is hidden from your feed and our team will review it within 24 hours.'
        : `Could not report: ${res.error}`,
    );
    refresh();
  };

  const doBlock = async (postId: string) => {
    const res = await blockPostAuthor(postId);
    setReportOn(null);
    flash(
      res.ok
        ? 'Blocked. You won’t see their posts or messages.'
        : res.error ?? 'Could not block that person.',
    );
    refresh();
  };

  const posts: PostRow[] = livePosts;

  const submitNew = async () => {
    setErr(null);
    if (body.trim().length < 3) return setErr('Write something first.');
    const res = await createPost(body);
    if (!res.ok) return setErr(res.error);
    setShowNew(false);
    setBody('');
  };

  const doVote = (id: string, dir: 1 | -1) => {
    vote(id, dir);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.container}>
        <View style={s.titleRow}>
          <ScreenTitle>Feed</ScreenTitle>
          {isStudent && (
            <Pressable
              style={s.addBtn}
              onPress={() => setShowNew(true)}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="button"
              accessibilityLabel="New post"
            >
              <Text style={s.addBtnText}>+ Post</Text>
            </Pressable>
          )}
        </View>
        <View style={s.filterRow}>
          <Pill label="Campus" />
        </View>
        {reportMsg && (
          <Card style={[s.empty, { backgroundColor: colors.accentSoft }]}>
            <Text style={type.subhead} accessibilityLiveRegion="polite" accessibilityRole="alert">
              {reportMsg}
            </Text>
          </Card>
        )}

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
              <View style={s.postHeader}>
                <Text style={type.caption}>
                  anonymous · {dayjs(item.created_at).fromNow()}
                </Text>
                <Pressable
                  onPress={() => setReportOn(item.id)}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                  accessibilityHint="Report or block the author of this post"
                >
                  <Text style={s.moreBtn} accessibilityElementsHidden>
                    •••
                  </Text>
                </Pressable>
              </View>
              <Text style={[type.body, s.postBody]}>{item.body}</Text>
              <View style={s.voteRow}>
                <Pressable
                  onPress={() => doVote(item.id, 1)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Upvote"
                  // State, not colour, is what carries "I voted" to VoiceOver.
                  accessibilityState={{ selected: item.myVote === 1 }}
                  style={[s.voteBtn, item.myVote === 1 && s.voteBtnUp]}
                >
                  <Text
                    style={[s.voteText, item.myVote === 1 && { color: '#fff' }]}
                    accessibilityElementsHidden
                  >
                    ▲
                  </Text>
                </Pressable>
                <Text
                  style={s.scoreText}
                  accessibilityLabel={`Score ${item.score}`}
                >
                  {item.score}
                </Text>
                <Pressable
                  onPress={() => doVote(item.id, -1)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Downvote"
                  accessibilityState={{ selected: item.myVote === -1 }}
                  style={[s.voteBtn, item.myVote === -1 && s.voteBtnDown]}
                >
                  <Text
                    style={[s.voteText, item.myVote === -1 && { color: '#fff' }]}
                    accessibilityElementsHidden
                  >
                    ▼
                  </Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      </View>

      <Sheet visible={showNew} onClose={() => setShowNew(false)} label="New post">
        <View style={s.modal}>
            <Text style={[type.title2, { marginBottom: spacing.m }]} accessibilityRole="header">
              New post
            </Text>
            <Text style={type.caption}>Posts are anonymous to other students.</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="What's happening on campus?"
              placeholderTextColor={colors.inkTertiary}
              value={body}
              onChangeText={setBody}
              multiline
              accessibilityLabel="Post text"
              accessibilityHint="Your post is anonymous to other students"
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
                accessibilityLabel="Post"
              >
                <Text style={s.mBtnText}>Post</Text>
              </Pressable>
          </View>
        </View>
      </Sheet>

      {/* Report / block */}
      <Sheet visible={!!reportOn} onClose={() => setReportOn(null)} label="Report this post">
        <View style={s.modal}>
          <Text style={[type.title2, { marginBottom: spacing.xs }]} accessibilityRole="header">
            Report this post
          </Text>
          <Text style={type.caption}>
            We review reports within 24 hours. The post is hidden from your feed right away.
          </Text>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r.key}
              style={s.reasonRow}
              onPress={() => submitReport(r.key)}
              accessibilityRole="button"
              accessibilityLabel={`Report for ${r.label}`}
            >
              <Text style={type.body}>{r.label}</Text>
              <Text style={s.chev} accessibilityElementsHidden>
                ›
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={s.blockRow}
            onPress={() => reportOn && doBlock(reportOn)}
            accessibilityRole="button"
            accessibilityLabel="Block this person"
            accessibilityHint="You will no longer see their posts or messages"
          >
            <Text style={[type.body, { color: colors.danger, fontWeight: '600' }]}>
              Block this person
            </Text>
          </Pressable>
          <Pressable
            style={[s.mBtn, s.mBtnGhost]}
            onPress={() => setReportOn(null)}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[s.mBtnText, { color: colors.ink }]}>Cancel</Text>
          </Pressable>
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
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moreBtn: { color: colors.inkTertiary, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  reasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  blockRow: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    marginTop: spacing.s,
  },
  chev: { color: colors.inkTertiary, fontSize: 20 },
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
