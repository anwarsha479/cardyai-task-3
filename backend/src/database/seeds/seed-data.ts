export const SEED_ORGANIZER = { email: 'organizer@example.test', name: 'Olivia Organizer' };

export const SEED_ATTENDEES = [
  'Aisha Khan',
  'Ben Carter',
  'Chloe Martin',
  'Daniel Osei',
  'Emma Rossi',
  'Farid Haddad',
  'Grace Liu',
  'Hugo Silva',
  'Isla Murphy',
  'Jonas Weber',
  'Kavya Nair',
  'Liam Novak',
].map((name, i) => ({ email: `attendee${i + 1}@example.test`, name }));

export type EventKey = 'jazz' | 'talks';

export const SEED_EVENTS: Record<
  EventKey,
  { name: string; description: string; venue: string; startsInDays: number; seatRows: number; seatsPerRow: number }
> = {
  jazz: {
    name: 'Riverside Jazz Night',
    description: 'An evening of live jazz by the river with the Harbour Quartet and guests.',
    venue: 'Harbour Hall',
    startsInDays: 21,
    seatRows: 10,
    seatsPerRow: 12,
  },
  talks: {
    name: 'Tech Talks: Building for Scale',
    description: 'Three short talks on designing systems that stay correct under load, followed by Q&A.',
    venue: 'Innovation Hub, Room 2',
    startsInDays: 35,
    seatRows: 6,
    seatsPerRow: 10,
  },
};

export const SEED_EVENT_START_HOUR = 19;

/** attendee is 1-based into SEED_ATTENDEES; daysAgo is when the booking was made. */
export const SEED_BOOKINGS: { attendee: number; event: EventKey; seats: string[]; status: 'confirmed' | 'cancelled'; daysAgo: number }[] = [
  { attendee: 1, event: 'jazz', seats: ['A5', 'A6'], status: 'confirmed', daysAgo: 12 },
  { attendee: 2, event: 'jazz', seats: ['A7', 'A8', 'A9'], status: 'confirmed', daysAgo: 11 },
  { attendee: 3, event: 'jazz', seats: ['B1', 'B2'], status: 'confirmed', daysAgo: 11 },
  { attendee: 4, event: 'jazz', seats: ['B6', 'B7', 'B8', 'B9'], status: 'confirmed', daysAgo: 10 },
  { attendee: 5, event: 'jazz', seats: ['C4'], status: 'confirmed', daysAgo: 10 },
  { attendee: 6, event: 'jazz', seats: ['C5', 'C6'], status: 'cancelled', daysAgo: 9 },
  { attendee: 7, event: 'jazz', seats: ['C5', 'C6'], status: 'confirmed', daysAgo: 8 },
  { attendee: 8, event: 'jazz', seats: ['D10', 'D11', 'D12'], status: 'confirmed', daysAgo: 8 },
  { attendee: 9, event: 'jazz', seats: ['E1', 'E2'], status: 'confirmed', daysAgo: 7 },
  { attendee: 10, event: 'jazz', seats: ['E6', 'E7'], status: 'confirmed', daysAgo: 6 },
  { attendee: 11, event: 'jazz', seats: ['F3', 'F4', 'F5', 'F6'], status: 'confirmed', daysAgo: 6 },
  { attendee: 12, event: 'jazz', seats: ['G8'], status: 'cancelled', daysAgo: 5 },
  { attendee: 1, event: 'jazz', seats: ['G9', 'G10'], status: 'confirmed', daysAgo: 5 },
  { attendee: 2, event: 'jazz', seats: ['H1', 'H2'], status: 'confirmed', daysAgo: 4 },
  { attendee: 3, event: 'jazz', seats: ['H11', 'H12'], status: 'cancelled', daysAgo: 3 },
  { attendee: 4, event: 'jazz', seats: ['I6', 'I7'], status: 'confirmed', daysAgo: 3 },
  { attendee: 5, event: 'jazz', seats: ['J1', 'J2', 'J3'], status: 'cancelled', daysAgo: 2 },
  { attendee: 6, event: 'jazz', seats: ['J5', 'J6'], status: 'confirmed', daysAgo: 1 },
  { attendee: 7, event: 'talks', seats: ['A1', 'A2'], status: 'confirmed', daysAgo: 10 },
  { attendee: 8, event: 'talks', seats: ['A3'], status: 'confirmed', daysAgo: 9 },
  { attendee: 9, event: 'talks', seats: ['A4', 'A5', 'A6'], status: 'confirmed', daysAgo: 9 },
  { attendee: 10, event: 'talks', seats: ['B2', 'B3'], status: 'cancelled', daysAgo: 8 },
  { attendee: 11, event: 'talks', seats: ['B5', 'B6'], status: 'confirmed', daysAgo: 7 },
  { attendee: 12, event: 'talks', seats: ['C1', 'C2', 'C3', 'C4'], status: 'confirmed', daysAgo: 6 },
  { attendee: 1, event: 'talks', seats: ['C7'], status: 'confirmed', daysAgo: 5 },
  { attendee: 2, event: 'talks', seats: ['D4', 'D5'], status: 'confirmed', daysAgo: 4 },
  { attendee: 3, event: 'talks', seats: ['D8', 'D9'], status: 'cancelled', daysAgo: 4 },
  { attendee: 4, event: 'talks', seats: ['E1', 'E2'], status: 'confirmed', daysAgo: 3 },
  { attendee: 5, event: 'talks', seats: ['E9', 'E10'], status: 'confirmed', daysAgo: 2 },
  { attendee: 6, event: 'talks', seats: ['F5'], status: 'confirmed', daysAgo: 1 },
];

export const EXPECTED_COUNTS = {
  users: 1 + SEED_ATTENDEES.length,
  events: 2,
  seats: 120 + 60,
  bookings: 30,
};
