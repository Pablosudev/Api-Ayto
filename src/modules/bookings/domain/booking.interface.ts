export type BookingState = 'free' | 'pending' | 'reserved';

export interface BookingInterface {
  id: number;
  name: string;
  phone: string;
  startDate: string;
  endDate: string;
  state: BookingState;
  notes: string | null;
  createDate: string;
}

export type BookingInputInterface = Omit<BookingInterface, 'id' | 'state' | 'createDate'>;

// Día ocupado tal como lo ve la web pública: solo la fecha y el estado, nunca
// los datos de la persona que ha reservado.
export interface OccupiedDayInterface {
  date: string;
  state: Exclude<BookingState, 'free'>;
}
