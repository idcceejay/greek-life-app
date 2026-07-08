import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Pill, ScreenTitle } from '../../components/ui';
import { posts as seed } from '../../lib/mock';
import { colors, radius, spacing, type } from '../../lib/theme';

/** Feed — anonymous campus posts with up/down votes (PDF page 5). */
export default function FeedScreen() {
  const [posts, setPosts] = useState(seed);
  const [votes, setVotes] = useState<Record<string, 1 | -1 | 0>>({});

  const vote = (id: string, dir: 1 | -1) => {
    setVotes((v) => ({ ...v, [id]: v[id] === dir ? 0 : dir }));
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.container}>
        <ScreenTitle>Feed</ScreenTitle>
        <View style={s.filterRow}>
          <Pill label="Campus · 5 miles" />
        </View>
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const my = votes[item.id] ?? 0;
            return (
              <Card style={s.post}>
                <Text style={type.caption}>anonymous · {item.ago}</Text>
                <Text style={[type.body, s.postBody]}>{item.body}</Text>
                <View style={s.voteRow}>
                  <Pressable
                    onPress={() => vote(item.id, 1)}
                    style={[s.voteBtn, my === 1 && s.voteBtnUp]}
                  >
                    <View style={[s.voteGlyph, { backgroundColor: my === 1 ? '#fff' : colors.accent }]} />
                    <Text style={[s.voteText, my === 1 && { color: '#fff' }]}>
                      {item.up + (my === 1 ? 1 : 0)}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => vote(item.id, -1)}
                    style={[s.voteBtn, my === -1 && s.voteBtnDown]}
                  >
                    <View style={[s.voteGlyph, { backgroundColor: my === -1 ? '#fff' : colors.inkTertiary }]} />
                    <Text style={[s.voteText, my === -1 && { color: '#fff' }]}>
                      {item.down + (my === -1 ? 1 : 0)}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, padding: spacing.l },
  filterRow: { marginBottom: spacing.l },
  post: { marginBottom: spacing.m, gap: spacing.s },
  postBody: { lineHeight: 23 },
  voteRow: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.xs },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
  },
  voteBtnUp: { backgroundColor: colors.accent },
  voteBtnDown: { backgroundColor: colors.inkSecondary },
  voteGlyph: { width: 12, height: 12, borderRadius: 4 },
  voteText: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
