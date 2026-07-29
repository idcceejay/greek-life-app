/**
 * Live data layer. Every hook returns real Supabase data; screens must handle
 * their own empty states. Demo/mock data is ONLY used when the app runs with
 * no backend configured (see lib/mock.ts + supabaseConfigured).
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';

// ---------------------------------------------------------------------------
// Types (shape of rows the app reads)
// ---------------------------------------------------------------------------
export type Org = {
  id: string;
  name: string;
  type: 'fraternity' | 'sorority' | 'club' | 'organization';
  school_id: string | null;
};

export type OrgMembership = { org: Org; role: 'admin' | 'treasurer' | 'user' | 'alumni' };

export type EventRow = {
  id: string;
  org_id: string;
  title: string;
  location_text: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  created_by: string | null;
};

export type ChatRow = {
  id: string;
  name: string | null;
  type: 'group' | 'dm' | 'announcement';
  lastMessage: string | null;
  lastAt: string | null;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string | null;
  body: string | null;
  created_at: string;
  sender_name?: string | null;
};

export type PostRow = {
  id: string;
  body: string;
  score: number;
  created_at: string;
  myVote: 1 | -1 | 0;
};

// ---------------------------------------------------------------------------
// Org membership
// ---------------------------------------------------------------------------
export function useMyOrg(userId: string | undefined) {
  const [membership, setMembership] = useState<OrgMembership | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !userId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('memberships')
      .select('role, organizations(id, name, type, school_id)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })
      .limit(1);
    const row = data?.[0] as { role: OrgMembership['role']; organizations: Org } | undefined;
    setMembership(row?.organizations ? { org: row.organizations, role: row.role } : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { membership, loading, refresh };
}

export async function createOrganization(name: string, type: Org['type']) {
  const { data, error } = await supabase.rpc('create_organization', {
    p_name: name,
    p_type: type,
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string; org_id?: string };
  return res.ok
    ? { ok: true as const, orgId: res.org_id! }
    : { ok: false as const, error: res.error ?? 'unknown' };
}

export async function listSchoolOrgs(): Promise<Org[]> {
  const { data } = await supabase
    .from('organizations')
    .select('id, name, type, school_id')
    .order('name');
  return (data as Org[]) ?? [];
}

export async function requestJoin(orgId: string, userId: string) {
  const { error } = await supabase
    .from('memberships')
    .insert({ org_id: orgId, user_id: userId, role: 'user', status: 'pending' });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export function useEvents(orgId: string | undefined) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !orgId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('events')
      .select('id, org_id, title, location_text, starts_at, ends_at, all_day, created_by')
      .eq('org_id', orgId)
      .order('starts_at');
    setEvents((data as EventRow[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, loading, refresh };
}

export async function createEvent(
  orgId: string,
  userId: string,
  fields: { title: string; location_text: string; starts_at: Date },
) {
  const { error } = await supabase.from('events').insert({
    org_id: orgId,
    created_by: userId,
    title: fields.title,
    location_text: fields.location_text || null,
    starts_at: fields.starts_at.toISOString(),
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function deleteEvent(eventId: string) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------
export function useChats(userId: string | undefined) {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !userId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('chat_members')
      .select('chat_id, chats(id, name, type, messages(body, created_at))')
      .eq('user_id', userId)
      .order('created_at', { referencedTable: 'chats.messages', ascending: false })
      .limit(1, { referencedTable: 'chats.messages' });
    const rows =
      (data as unknown as {
        chats: {
          id: string;
          name: string | null;
          type: ChatRow['type'];
          messages: { body: string | null; created_at: string }[];
        } | null;
      }[]) ?? [];
    const mapped: ChatRow[] = rows
      .filter((r) => r.chats)
      .map((r) => ({
        id: r.chats!.id,
        name: r.chats!.name,
        type: r.chats!.type,
        lastMessage: r.chats!.messages?.[0]?.body ?? null,
        lastAt: r.chats!.messages?.[0]?.created_at ?? null,
      }))
      .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
    setChats(mapped);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { chats, loading, refresh };
}

export async function createGroupChat(name: string, orgId: string | null, userId: string) {
  const { data, error } = await supabase
    .from('chats')
    .insert({ name, org_id: orgId, type: 'group', created_by: userId })
    .select('id')
    .single();
  if (error) return { ok: false as const, error: error.message };
  const chatId = (data as { id: string }).id;
  const { error: e2 } = await supabase
    .from('chat_members')
    .insert({ chat_id: chatId, user_id: userId, role: 'admin' });
  if (e2) return { ok: false as const, error: e2.message };
  return { ok: true as const, chatId };
}

export function useMessages(chatId: string | undefined, userId: string | undefined) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured || !chatId) {
      setLoading(false);
      return;
    }
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, chat_id, sender_id, body, created_at, profiles(full_name, username)')
        .eq('chat_id', chatId)
        .is('deleted_at', null)
        .order('created_at');
      if (!active) return;
      const rows =
        (data as unknown as (MessageRow & {
          profiles: { full_name: string | null; username: string | null } | null;
        })[]) ?? [];
      setMessages(
        rows.map((m) => ({
          ...m,
          sender_name: m.profiles?.full_name ?? m.profiles?.username ?? null,
        })),
      );
      setLoading(false);
      // mark read
      await supabase
        .from('chat_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .eq('user_id', userId ?? '');
    };
    load();

    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [chatId, userId]);

  const send = useCallback(
    async (body: string) => {
      if (!chatId || !userId || !body.trim()) return;
      await supabase
        .from('messages')
        .insert({ chat_id: chatId, sender_id: userId, body: body.trim() });
    },
    [chatId, userId],
  );

  return { messages, loading, send };
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------
export function usePosts(schoolId: string | null | undefined, userId: string | undefined) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !schoolId || !userId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('posts')
      .select('id, body, score, created_at, post_votes(value, user_id)')
      .eq('scope', 'campus')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
    const rows =
      (data as unknown as (Omit<PostRow, 'myVote'> & {
        post_votes: { value: number; user_id: string }[];
      })[]) ?? [];
    setPosts(
      rows.map((p) => ({
        id: p.id,
        body: p.body,
        score: p.score,
        created_at: p.created_at,
        myVote: (p.post_votes.find((v) => v.user_id === userId)?.value ?? 0) as 1 | -1 | 0,
      })),
    );
    setLoading(false);
  }, [schoolId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createPost = useCallback(
    async (body: string) => {
      if (!schoolId || !userId || !body.trim()) return { ok: false as const, error: 'empty' };
      const { error } = await supabase.from('posts').insert({
        scope: 'campus',
        school_id: schoolId,
        author_id: userId,
        body: body.trim(),
      });
      if (error) return { ok: false as const, error: error.message };
      await refresh();
      return { ok: true as const };
    },
    [schoolId, userId, refresh],
  );

  const vote = useCallback(
    async (postId: string, value: 1 | -1) => {
      if (!userId) return;
      const current = posts.find((p) => p.id === postId)?.myVote ?? 0;
      if (current === value) {
        await supabase.from('post_votes').delete().eq('post_id', postId).eq('user_id', userId);
      } else {
        await supabase
          .from('post_votes')
          .upsert({ post_id: postId, user_id: userId, value }, { onConflict: 'post_id,user_id' });
      }
      await refresh();
    },
    [userId, posts, refresh],
  );

  return { posts, loading, refresh, createPost, vote };
}

// ---------------------------------------------------------------------------
export async function signOut() {
  await supabase.auth.signOut();
}
