import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  birthday: string;
  account_type: 'student' | 'alumni';
  school_id: string | null;
  avatar_url: string | null;
};

export function useSession() {
  const [loading, setLoading] = useState(supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setProfileChecked(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !session) {
      setProfile(null);
      if (!session) setProfileChecked(true);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, username, full_name, birthday, account_type, school_id, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile((data as Profile) ?? null);
        setProfileChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  return {
    demoMode: !supabaseConfigured,
    loading: loading || (!!session && !profileChecked),
    session,
    profile,
    refreshProfile: async () => {
      if (!session) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, birthday, account_type, school_id, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    },
  };
}
