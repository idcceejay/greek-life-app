import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { supabase, supabaseConfigured } from './supabase';

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

/** Demo pins arranged around a center point (used when Supabase is not configured). */
/**
 * Snap-map style live location:
 * - asks foreground permission, follows the device position
 * - publishes a ping to Supabase once a minute while the map is open (students only;
 *   RLS enforces sharing/ghost settings on the read side)
 * - polls visible chapter members' latest pins
 * No background tracking, no speed — presence, not surveillance.
 */
export function useLiveMap(enabled: boolean, isStudent: boolean) {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const lastPublish = useRef(0);

  // Follow device position
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
          // Publish (throttled) — WKT is lng lat order
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

  // Poll visible pins
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval>;
    const load = async () => {
      const { data } = await supabase.rpc('get_visible_locations');
      if (data) setPins(data as MapPin[]);
    };
    load();
    timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, me === null]);

  return { permission, me, pins };
}

/** Great-circle distance in miles between two points. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
