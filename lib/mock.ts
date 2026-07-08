/**
 * Demo data matching the UI Layout PDF. Screens render this until Supabase is
 * configured; each screen's data hook swaps to live queries when it is.
 */
export type MockChat = {
  id: string;
  name: string;
  initials: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

export type MockEvent = {
  id: string;
  title: string;
  startsAtLabel: string;
  time: string;
  place: string;
  dayOffset: number; // days from "today" in the demo week
};

export type MockPost = {
  id: string;
  body: string;
  ago: string;
  up: number;
  down: number;
};

export type MockNearby = {
  id: string;
  name: string;
  initials: string;
  place: string;
  distanceMi: number;
  /** position on the demo map, 0..1 */
  x: number;
  y: number;
  isSelf?: boolean;
};

export const org = {
  name: 'Sigma House',
  kind: 'Chapter',
  duesDueCents: 15000,
  membersNearby: 9,
};

export const nextEvent = {
  title: 'Spring Formal',
  when: 'FRI 8:00 PM',
  rsvpGoing: 24,
};

export const chats: MockChat[] = [
  { id: '1', name: 'Rush Committee', initials: 'RC', lastMessage: 'meeting moved to 7pm', lastAt: '2m', unread: 2 },
  { id: '2', name: 'Exec Board', initials: 'EB', lastMessage: 'budget approved', lastAt: '18m', unread: 0 },
  { id: '3', name: 'Philanthropy', initials: 'PH', lastMessage: 'who is driving Saturday?', lastAt: '1h', unread: 1 },
  { id: '4', name: 'Intramurals', initials: 'IM', lastMessage: 'great game last night', lastAt: '3h', unread: 0 },
  { id: '5', name: 'All Members', initials: 'AM', lastMessage: 'reminder: dues Friday', lastAt: '1d', unread: 0 },
];

export const events: MockEvent[] = [
  { id: '1', title: 'Spring Formal', startsAtLabel: 'Friday', time: '8:00 PM', place: 'Grand Ballroom', dayOffset: 0 },
  { id: '2', title: 'Chapter Meeting', startsAtLabel: 'Friday', time: '5:00 PM', place: 'Sigma House', dayOffset: 0 },
  { id: '3', title: 'Philanthropy Car Wash', startsAtLabel: 'Friday', time: '12:00 PM', place: 'Lot C', dayOffset: 0 },
];

export const posts: MockPost[] = [
  { id: '1', body: 'Whoever picked the formal venue this year, 10 out of 10. Best one we have had.', ago: '2h', up: 142, down: 23 },
  { id: '2', body: 'Lost a navy jacket at the mixer last night. Please DM if you found it.', ago: '4h', up: 57, down: 8 },
  { id: '3', body: 'Reminder: dues are due Friday or you are off the formal list.', ago: '6h', up: 98, down: 41 },
];

export const nearby: MockNearby[] = [
  { id: '1', name: 'Alex Brooks', initials: 'AB', place: 'Library', distanceMi: 0.2, x: 0.25, y: 0.28 },
  { id: '2', name: 'Jamie Lee', initials: 'JL', place: 'The House', distanceMi: 0.0, x: 0.53, y: 0.42, isSelf: false },
  { id: '3', name: 'Sam Patel', initials: 'SP', place: 'Off campus', distanceMi: 3.1, x: 0.74, y: 0.62 },
  { id: '4', name: 'You', initials: 'ME', place: 'The House', distanceMi: 0, x: 0.41, y: 0.5, isSelf: true },
  { id: '5', name: 'Riley Chen', initials: 'RC', place: 'Gym', distanceMi: 0.6, x: 0.61, y: 0.2 },
  { id: '6', name: 'Dana Fox', initials: 'DF', place: 'Quad', distanceMi: 0.4, x: 0.33, y: 0.74 },
];

export const messagesByChat: Record<string, { id: string; from: string; mine: boolean; body: string; at: string }[]> = {
  '1': [
    { id: 'a', from: 'Jordan', mine: false, body: 'Heads up — room conflict tonight', at: '6:41 PM' },
    { id: 'b', from: 'Jordan', mine: false, body: 'meeting moved to 7pm', at: '6:42 PM' },
    { id: 'c', from: 'You', mine: true, body: 'Got it, I will update the calendar', at: '6:45 PM' },
  ],
  '2': [
    { id: 'a', from: 'Taylor', mine: false, body: 'budget approved', at: '5:02 PM' },
    { id: 'b', from: 'You', mine: true, body: 'formal is officially on 🎉', at: '5:04 PM' },
  ],
  '3': [
    { id: 'a', from: 'Morgan', mine: false, body: 'who is driving Saturday?', at: '4:12 PM' },
  ],
};
