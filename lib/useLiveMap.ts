import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { supabase, supabaseConfigured } from './supabase';
import { nearby as mockNearby } from './mock';

export type MapPin = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  lat: number;
  lng: number;
  place_label: string | null;
  captured_at: string;
  is_self: boolean;
};

const PUBLISH_INTERVAL_MS = 60_000;
const REFRESH_INTERVAL_MS = 30_000;

function demoPins(center: { lat: number; lng: number }): MapPin[] {
  return mockNearby.map((n) => ({
    user_id: n.id,
    username: n.name.toLowerCase().replace(/\s/g, '_'),
    full_name: n.name,
    lat: center.lat + (n.y - 0.5) * 0.012,
    lng: center.lng + (n.x - 0.5) * 0.012,
    place_label: n.place,
    captured_at: new Date().toISOString(),
    is_self: !!n.isSelf,
  }));
}

export function useLiveMap(enabled: boolean, isStudent: boolean) {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const lastPublish = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermission(status === 'granted' ? 'granted' : 'denied');
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15_000, distanceInterval: 25 },
        (pos) => {
          const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMe(point);
          if (
            supabaseConfigured &&
            isStudent &&
            Date.now() - lastPublish.current > PUBLISH_INTERVAL_MS
          ) {
            lastPublish.current = Date.now();
            supabase
              .from('locations')
              .insert({
                point: `POINT(${point.lng} ${point.lat})`,
                accuracy_m: pos.coords.accuracy,
              })
              .then(() => {});
          }
        },
      );
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, isStudent]);

  useEffect(() => {
    if (!enabled) return;
    if (!supabaseConfigured) {
      const center = me ?? { lat: 33.948, lng: -83.3773 };
      setPins(demoPins(center));
      return;
    }
    const load = async () => {
      const { data } = await supabase.rpc('get_visible_locations');
      if (data) setPins(data as MapPin[]);
    };
    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, me === null]);

  return { permission, me, pins };
}

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
