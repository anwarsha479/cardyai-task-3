export type Role = 'attendee' | 'organizer';

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: UserView;
}

export interface SeatCounts {
  capacity: number;
  available: number;
  held: number;
  booked: number;
}

export interface EventView {
  id: string;
  name: string;
  description: string | null;
  venue: string;
  startsAt: string;
  seatRows: number;
  seatsPerRow: number;
  isOpen: boolean;
  seats: SeatCounts;
}

export interface EventInput {
  name: string;
  description: string | null;
  venue: string;
  startsAt: string;
  seatRows: number;
  seatsPerRow: number;
}

export type SeatStatus = 'available' | 'held' | 'booked';

export interface SeatRef {
  row: number;
  number: number;
  label: string;
}

export interface Seat extends SeatRef {
  status: SeatStatus;
  mine: boolean;
}

export interface SeatMap {
  event: EventView;
  serverTime: string;
  maxSeatsPerBooking: number;
  holdDurationMinutes: number;
  seats: Seat[];
  myHold: { id: string; expiresAt: string; seats: SeatRef[] } | null;
}

export type BookingStatus = 'held' | 'confirmed' | 'expired' | 'cancelled';

export interface BookingView {
  id: string;
  status: BookingStatus;
  event: { id: string; name: string; venue: string; startsAt: string };
  seats: SeatRef[];
  holdExpiresAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface SettingView {
  key: 'holdDurationMinutes' | 'maxSeatsPerBooking';
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}

export interface ApiErrorBody {
  code: string;
  reason?: string;
  message: string;
  details?: { fields?: Record<string, string[]>; seats?: string[] } & Record<string, unknown>;
}
