import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Avatar, ScreenTitle } from '../../components/ui';
import { chats } from '../../lib/mock';
import { colors, radius, spacing, type } from '../../lib/theme';

/** Chats — list per the UI Layout PDF (page 2). */
export default function ChatsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const data = chats.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.container}>
        <ScreenTitle>Chats</ScreenTitle>
        <TextInput
          style={s.search}
          placeholder="Search"
          placeholderTextColor={colors.inkTertiary}
          value={query}
          onChangeText={setQuery}
        />
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/chat/${item.id}`)}>
              <Avatar initials={item.initials} />
              <View style={s.rowBody}>
                <Text style={type.headline}>{item.name}</Text>
                <Text style={type.subhead} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <View style={s.rowMeta}>
                <Text style={type.caption}>{item.lastAt}</Text>
                {item.unread > 0 && <View style={s.unreadDot} />}
              </View>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, padding: spacing.l },
  search: {
    backgroundColor: '#E4E3E9',
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 10,
    fontSize: 17,
    marginBottom: spacing.l,
    color: colors.ink,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.m },
  rowBody: { flex: 1, marginLeft: spacing.m, gap: 2 },
  rowMeta: { alignItems: 'flex-end', gap: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  sep: { height: 1, backgroundColor: colors.separator, marginLeft: 60 },
});
