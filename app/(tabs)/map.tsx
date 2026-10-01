import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// react-native-maps needs a native build (TestFlight/dev build) — Expo Go
// doesn't bundle it, so load it dynamically and fall back to a styled preview.
let MapView: any = null;
let Marker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  // Expo Go: no native maps module — fallback view is used below.
}
import { Avatar, Icon } from '../../components/ui';
import { useSession } from '../../lib/useSession';
import { useLiveMap, milesBetween, MapPin } from '../../lib/useLiveMap';
import { supabase } from '../../lib/supabase';
import { colors, iconSize, radius, spacing, type } from '../../lib/theme';

const CAMPUS_FALLBACK = { latitude: 33.948, longitude: -83.3773 };

/**
 * Live member map (Snap-map style): real map, chapter members' latest pins,
 * ghost mode, and location-verified event check-in. Foreground presence only —
 * no background tracking, no driving/speed features.
 */
export default function MapScreen() {
  const { profile } = useSession();
  const isStudent = profile?.account_type === 'student';
  const { permission, me, pins } = useLiveMap(true, !!isStudent);
  const [ghost, setGhost] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);

  const center = me
    ? { latitude: me.lat, longitude: me.lng }
    : pins.length
      ? { latitude: pins[0].lat, longitude: pins[0].lng }
      : CAMPUS_FALLBACK;

  const others = useMemo(() => {
    const list = pins.filter((p) => !p.is_self);
    if (!me) return list;
    return [...list].sort(
      (a, b) =>
        milesBetween(me, { lat: a.lat, lng: a.lng }) - milesBetween(me, { lat: b.lat, lng: b.lng }),
    );
  }, [pins, me]);

  const toggleGhost = async () => {
    const next = !ghost;
    setGhost(next);
    await supabase.from('location_settings').upsert({ ghost_mode: next });
  };

  const checkIn = async () => {
    if (!me) {
      setCheckinMsg('Waiting for your location…');
      return;
    }
    // Find today's check-in-enabled event for my orgs (first match)
    const { data: events } = await supabase
      .from('events')
      .select('id, title')
      .eq('checkin_enabled', true)
      .gte('starts_at', new Date(Date.now() - 6 * 3600_000).toISOString())
      .lte('starts_at', new Date(Date.now() + 24 * 3600_000).toISOString())
      .limit(1);
    if (!events?.length) {
      setCheckinMsg('No check-in events right now.');
      return;
    }
    const { data, error } = await supabase.rpc('checkin_to_event', {
      p_event: events[0].id,
      p_lat: me.lat,
      p_lng: me.lng,
    });
    if (error) return setCheckinMsg(error.message);
    const res = data as { ok: boolean; error?: string; distance_m?: number };
    if (res.ok) setCheckinMsg(`Checked in to ${events[0].title} ✓`);
    else if (res.error === 'too_far')
      setCheckinMsg(`Too far away (${Math.round(res.distance_m ?? 0)} m). Get closer and retry.`);
    else setCheckinMsg(`Couldn't check in: ${res.error}`);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.headerRow}>
        <Text style={type.largeTitle} accessibilityRole="header">
          Map
        </Text>
        <Pressable
          onPress={toggleGhost}
          style={[s.ghostBtn, ghost && s.ghostBtnOn]}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="switch"
          accessibilityLabel="Ghost mode"
          accessibilityHint="Hides your location from other members"
          accessibilityState={{ checked: ghost }}
        >
          <Icon
            name={ghost ? 'eye-off-outline' : 'eye-outline'}
            size={iconSize.s}
            color={ghost ? '#FFFFFF' : colors.inkSecondary}
          />
          <Text style={[s.ghostText, ghost && { color: '#fff' }]}>Ghost mode</Text>
          {/* Drawn track so the control reads as a setting, not a status. */}
          <View style={[s.track, ghost && s.trackOn]}>
            <View style={[s.knob, ghost && s.knobOn]} />
          </View>
        </Pressable>
      </View>

      <View style={s.mapWrap}>
        {MapView ? (
          <MapView
            style={s.map}
            region={{ ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
            showsUserLocation
            showsMyLocationButton
          >
            {others.map((p: MapPin) => (
              <Marker
                key={p.user_id}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                title={p.full_name ?? p.username ?? 'Member'}
                description={p.place_label ?? undefined}
                pinColor={colors.accent}
              />
            ))}
          </MapView>
        ) : (
          <View style={[s.map, s.fallbackMap]}>
            {others.map((p: MapPin) => {
              const relX = 0.5 + (p.lng - center.longitude) / 0.024;
              const relY = 0.5 - (p.lat - center.latitude) / 0.024;
              return (
                <View
                  key={p.user_id}
                  style={[
                    s.fallbackPin,
                    {
                      left: `${Math.min(92, Math.max(4, relX * 100))}%`,
                      top: `${Math.min(88, Math.max(6, relY * 100))}%`,
                    },
                  ]}
                >
                  <View style={s.fallbackPinInner} />
                </View>
              );
            })}
            <View style={s.fallbackNote}>
              <Text style={s.permText}>
                Preview map (Expo Go). The full Apple Maps view arrives with the TestFlight build.
              </Text>
            </View>
          </View>
        )}
        {permission === 'denied' && (
          <View style={s.permBanner}>
            <Text style={s.permText}>
              Location is off — enable it in Settings to appear on the map and check in to events.
            </Text>
          </View>
        )}
      </View>

      <View style={s.sheet}>
        <View style={s.grabber} />
        <View style={s.sheetHeader}>
          <Text style={type.title2} accessibilityRole="header">
            Nearby
          </Text>
          <Pressable
            style={s.checkinBtn}
            onPress={checkIn}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Check in"
            accessibilityHint="Checks you in to a nearby event using your location"
          >
            <Text style={s.checkinText}>Check in</Text>
          </Pressable>
        </View>
        {checkinMsg && (
          <Text
            style={s.checkinMsg}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {checkinMsg}
          </Text>
        )}
        <FlatList
          data={others}
          keyExtractor={(p) => p.user_id}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => {
            const dist = me ? milesBetween(me, { lat: item.lat, lng: item.lng }) : null;
            const initials = (item.full_name ?? item.username ?? '?')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <View
                style={s.row}
                accessible
                accessibilityLabel={`${item.full_name ?? item.username}, ${
                  item.place_label ?? 'on the map'
                }${dist !== null ? `, ${dist.toFixed(1)} miles away` : ''}`}
              >
                <Avatar initials={initials} />
                <View style={s.rowBody}>
                  <Text style={type.headline}>{item.full_name ?? item.username}</Text>
                  <Text style={type.subhead}>{item.place_label ?? 'On the map'}</Text>
                </View>
                {dist !== null && <Text style={type.caption}>{dist.toFixed(1)} mi</Text>}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={[type.subhead, { paddingVertical: spacing.m }]}>
              No members sharing right now.
            </Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.s,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingLeft: 14,
    paddingRight: 6,
  },
  ghostBtnOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  ghostText: { color: colors.ink, fontWeight: '600', fontSize: 15 },
  track: { width: 40, height: 24, borderRadius: 12, backgroundColor: colors.fill, padding: 2 },
  trackOn: { backgroundColor: colors.accent },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  knobOn: { alignSelf: 'flex-end' },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  fallbackMap: { backgroundColor: colors.mapTint },
  fallbackPin: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  fallbackPinInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  fallbackNote: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderRadius: radius.control,
    padding: 10,
    opacity: 0.95,
  },
  permBanner: {
    position: 'absolute',
    top: spacing.m,
    left: spacing.l,
    right: spacing.l,
    backgroundColor: colors.card,
    borderRadius: radius.control,
    padding: spacing.m,
  },
  permText: { fontSize: 13, color: colors.inkSecondary },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
    maxHeight: 300,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.separator,
    marginVertical: spacing.m,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  checkinBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  checkinText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  checkinMsg: { fontSize: 13, color: colors.inkSecondary, marginBottom: spacing.s },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.m },
  rowBody: { flex: 1, marginLeft: spacing.m, gap: 2 },
  sep: { height: 1, backgroundColor: colors.separator, marginLeft: 60 },
});
