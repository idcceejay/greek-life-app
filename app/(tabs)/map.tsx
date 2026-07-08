import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, ScreenTitle } from '../../components/ui';
import { nearby } from '../../lib/mock';
import { colors, radius, spacing, type } from '../../lib/theme';

/**
 * Map — live member map + "Nearby" bottom sheet (PDF page 1).
 * The map canvas is a styled placeholder; swap in `react-native-maps`
 * (already version-pinned by Expo) once running on a device build.
 * Live positions come from the `latest_locations` view over Supabase Realtime.
 */
export default function MapScreen() {
  const list = nearby.filter((n) => !n.isSelf);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <ScreenTitle>Map</ScreenTitle>
      </View>

      {/* Map canvas */}
      <View style={s.map}>
        {nearby.map((n) => (
          <View
            key={n.id}
            style={[
              s.pin,
              {
                left: `${n.x * 100}%`,
                top: `${n.y * 100}%`,
                backgroundColor: n.isSelf ? colors.success : colors.accent,
              },
            ]}
          >
            <View style={s.pinInner} />
          </View>
        ))}
      </View>

      {/* Nearby sheet */}
      <View style={s.sheet}>
        <View style={s.grabber} />
        <Text style={[type.title2, s.sheetTitle]}>Nearby</Text>
        <FlatList
          data={list}
          keyExtractor={(n) => n.id}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <Avatar initials={item.initials} />
              <View style={s.rowBody}>
                <Text style={type.headline}>{item.name}</Text>
                <Text style={type.subhead}>{item.place}</Text>
              </View>
              <Text style={type.caption}>{item.distanceMi.toFixed(1)} mi</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.l, paddingBottom: spacing.s },
  map: { flex: 1, backgroundColor: colors.mapTint },
  pin: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
    maxHeight: 320,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.separator,
    marginVertical: spacing.m,
  },
  sheetTitle: { marginBottom: spacing.m },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.m },
  rowBody: { flex: 1, marginLeft: spacing.m, gap: 2 },
  sep: { height: 1, backgroundColor: colors.separator, marginLeft: 60 },
});
