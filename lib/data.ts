/**
 * Live data layer. Every hook returns real Supabase data and screens render
 * their own empty states. There is no mock/demo data anywhere in the app.
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
  rrule: string | null; // e.g. 'FREQ=YEARLY' for birthdays/anniversaries
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
      .select('id, org_id, title, location_text, starts_at, ends_at, all_day, created_by, rrule')
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
  fields: { title: string; location_text: string; starts_at: Date; rrule?: string | null },
) {
  const { error } = await supabase.from('events').insert({
    org_id: orgId,
    created_by: userId,
    title: fields.title,
    location_text: fields.location_text || null,
    starts_at: fields.starts_at.toISOString(),
    rrule: fields.rrule ?? null,
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

/** Atomic (RPC): creates the chat and makes the caller its admin member. */
export async function createGroupChat(name: string, orgId: string | null) {
  const { data, error } = await supabase.rpc('create_group_chat', {
    p_name: name,
    p_org: orgId,
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string; chat_id?: string };
  return res.ok
    ? { ok: true as const, chatId: res.chat_id! }
    : { ok: false as const, error: res.error ?? 'unknown' };
}

/** Shareable invite code for a chat (admins only). Reuses an active code. */
export async function createChatInvite(chatId: string) {
  const { data, error } = await supabase.rpc('create_chat_invite', { p_chat: chatId });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string; token?: string };
  return res.ok
    ? { ok: true as const, token: res.token! }
    : { ok: false as const, error: res.error ?? 'unknown' };
}

export async function joinChatWithCode(token: string) {
  const { data, error } = await supabase.rpc('join_chat_via_invite', {
    p_token: token.trim(),
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string; chat_id?: string };
  return res.ok
    ? { ok: true as const, chatId: res.chat_id! }
    : { ok: false as const, error: res.error ?? 'unknown' };
}

export type UserHit = { id: string; username: string | null; full_name: string | null };

export async function searchUsers(query: string): Promise<UserHit[]> {
  if (query.trim().length < 2) return [];
  const { data } = await supabase.rpc('search_users', { p_query: query });
  return (data as UserHit[]) ?? [];
}

export async function addChatMember(chatId: string, username: string) {
  const { data, error } = await supabase.rpc('add_chat_member_by_username', {
    p_chat: chatId,
    p_username: username,
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string };
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error ?? 'unknown' };
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
// Moderation & account (App Store compliance)
// ---------------------------------------------------------------------------
export type ReportTarget = 'post' | 'comment' | 'message' | 'profile';
export type ReportReason = 'harassment' | 'hate' | 'spam' | 'danger' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate speech' },
  { key: 'danger', label: 'Violence or self-harm' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'other', label: 'Something else' },
];

export async function reportContent(
  targetType: ReportTarget,
  targetId: string,
  reason: ReportReason,
  detail?: string,
) {
  const { data, error } = await supabase.rpc('report_content', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_detail: detail ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string; auto_hidden?: boolean };
  return res.ok
    ? { ok: true as const, autoHidden: !!res.auto_hidden }
    : { ok: false as const, error: res.error ?? 'unknown' };
}

export async function blockUser(userId: string) {
  const { data, error } = await supabase.rpc('block_user', { p_user: userId });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string };
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error ?? 'unknown' };
}

export async function blockPostAuthor(postId: string) {
  const { data, error } = await supabase.rpc('block_post_author', { p_post: postId });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string };
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error ?? 'unknown' };
}

export async function listBlockedUsers(): Promise<UserHit[]> {
  const { data } = await supabase.rpc('my_blocked_users');
  return ((data as { user_id: string; username: string; full_name: string }[]) ?? []).map((r) => ({
    id: r.user_id,
    username: r.username,
    full_name: r.full_name,
  }));
}

export async function unblockUser(userId: string) {
  const { error } = await supabase.from('user_blocks').delete().eq('blocked_id', userId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** Permanent, irreversible. Required in-app by App Store Guideline 5.1.1(v). */
export async function deleteMyAccount() {
  const { data, error } = await supabase.rpc('delete_my_account');
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string };
  if (!res.ok) return { ok: false as const, error: res.error ?? 'unknown' };
  await supabase.auth.signOut();
  return { ok: true as const };
}

export async function updateProfile(fields: { full_name?: string; username?: string }) {
  const { error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function setGhostMode(on: boolean) {
  const { error } = await supabase.from('location_settings').upsert({ ghost_mode: on });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Member management (roster, approvals, roles)
//
// RLS already supports all of this (0003_rls.sql):
//   memberships_read          members see the roster
//   memberships_admin_update  admins approve and change roles
//   memberships_admin_delete  admins remove; users may leave
// so these are plain table writes rather than RPCs. The only server-side
// surprise is trg_protect_last_admin (0010), which refuses to demote or remove
// an org's final active admin; its message is already user-facing, so it is
// passed straight through.
//
// Decline and remove DELETE the row rather than setting status = 'removed'.
// memberships has UNIQUE (org_id, user_id) and memberships_self_request only
// permits inserting a 'pending' row, so a lingering 'removed' row would lock
// that person out of ever requesting again.
// ---------------------------------------------------------------------------

export type MemberRole = 'admin' | 'treasurer' | 'user' | 'alumni';
export type MemberStatus = 'pending' | 'active' | 'removed';

export type MemberRow = {
  id: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  fullName: string | null;
  username: string | null;
};

export const MEMBER_ROLES: { key: MemberRole; label: string; blurb: string }[] = [
  { key: 'admin', label: 'Admin', blurb: 'Full control: roster, roles, events, chats' },
  { key: 'treasurer', label: 'Treasurer', blurb: 'Dues and payments, plus everything a member can do' },
  { key: 'user', label: 'Member', blurb: 'Standard chapter member' },
  { key: 'alumni', label: 'Alumni', blurb: 'Calendar access only; cannot be made admin' },
];

type ProfileBit = { full_name: string | null; username: string | null };

type MembershipQueryRow = {
  id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  // Supabase types an embedded relation as an array even though membership ->
  // profile is many-to-one and arrives as a single object at runtime. Accept
  // both and normalise in one place.
  profiles: ProfileBit | ProfileBit[] | null;
};

function oneProfile(p: MembershipQueryRow['profiles']): ProfileBit | null {
  if (!p) return null;
  return Array.isArray(p) ? p[0] ?? null : p;
}

/**
 * Roster for one organization, split into the three groups the screen shows.
 *
 * profiles may come back null: profiles_read grants access via
 * shares_active_org_with() OR same school, and a *pending* applicant satisfies
 * neither branch if their school_id was never set. The row is still returned,
 * so the screen falls back to a placeholder name rather than rendering blank.
 */
export function useMembers(orgId: string | undefined) {
  const [pending, setPending] = useState<MemberRow[]>([]);
  const [active, setActive] = useState<MemberRow[]>([]);
  const [alumni, setAlumni] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !orgId) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: qErr } = await supabase
      .from('memberships')
      .select('id, user_id, role, status, joined_at, profiles(full_name, username)')
      .eq('org_id', orgId)
      .neq('status', 'removed')
      .order('joined_at', { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }

    const rows: MemberRow[] = ((data as unknown as MembershipQueryRow[] | null) ?? []).map((r) => {
      const p = oneProfile(r.profiles);
      return {
        id: r.id,
        userId: r.user_id,
        role: r.role,
        status: r.status,
        joinedAt: r.joined_at,
        fullName: p?.full_name ?? null,
        username: p?.username ?? null,
      };
    });

    setPending(rows.filter((r) => r.status === 'pending'));
    setActive(rows.filter((r) => r.status === 'active' && r.role !== 'alumni'));
    setAlumni(rows.filter((r) => r.status === 'active' && r.role === 'alumni'));
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pending, active, alumni, loading, error, refresh };
}

/** Count of pending join requests, for the badge on the Home org card. */
export function usePendingCount(orgId: string | undefined) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured || !orgId) return;
    const { count: n } = await supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'pending');
    setCount(n ?? 0);
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { count, refresh };
}

export async function approveMember(membershipId: string) {
  const { error } = await supabase
    .from('memberships')
    .update({ status: 'active' })
    .eq('id', membershipId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** Decline a request. Deletes the row so the person can apply again later. */
export async function declineMember(membershipId: string) {
  const { error } = await supabase.from('memberships').delete().eq('id', membershipId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function setMemberRole(membershipId: string, role: MemberRole) {
  const { error } = await supabase.from('memberships').update({ role }).eq('id', membershipId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** Remove a member. Deletes the row so they can rejoin later if invited back. */
export async function removeMember(membershipId: string) {
  const { error } = await supabase.from('memberships').delete().eq('id', membershipId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
