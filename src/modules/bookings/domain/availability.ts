import type {
  BookingInterface,
  BookingState,
  OccupiedDayInterface,
} from './booking.interface';

// Estados que ocupan el calendario. 'free' es un estado calculado, no se persiste.
const BLOCKING_STATES: BookingState[] = ['pending', 'reserved'];

// La reserva es por día completo: nos quedamos con el día (YYYY-MM-DD).
// Las cadenas 'YYYY-MM-DD' se comparan cronológicamente de forma lexicográfica.
const toDay = (dateTime: string): string => dateTime.slice(0, 10);

// Dos rangos [aStart, aEnd] y [bStart, bEnd] entran en conflicto si comparten
// al menos un día (comparación inclusiva, porque se ocupa el día completo).
export function rangesConflict(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return toDay(aStart) <= toDay(bEnd) && toDay(bStart) <= toDay(aEnd);
}

// Reservas activas (pending/reserved) que solapan el rango indicado.
export function findConflicts(
  bookings: BookingInterface[],
  startDate: string,
  endDate: string,
): BookingInterface[] {
  return bookings.filter(
    (booking) =>
      BLOCKING_STATES.includes(booking.state) &&
      rangesConflict(startDate, endDate, booking.startDate, booking.endDate),
  );
}

const DAY_MS = 86_400_000;
const addDays = (day: string, amount: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);

// Un día válido del calendario con formato 'YYYY-MM-DD' (rechaza, p. ej., 2026-02-30).
export function isDay(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    addDays(value, 0) === value
  );
}

// Días ocupados dentro de [from, to] (ambos 'YYYY-MM-DD', inclusivos). Una
// reserva de varios días ocupa cada uno de ellos; si dos reservas coinciden en
// un día, prevalece la confirmada.
export function occupiedDays(
  bookings: BookingInterface[],
  from: string,
  to: string,
): OccupiedDayInterface[] {
  const days = new Map<string, OccupiedDayInterface['state']>();

  for (const booking of bookings) {
    if (booking.state === 'free') continue;
    const start = toDay(booking.startDate);
    const end = toDay(booking.endDate);
    if (!isDay(start) || !isDay(end)) continue;

    const last = end < to ? end : to;
    for (let day = start > from ? start : from; day <= last; day = addDays(day, 1)) {
      if (days.get(day) !== 'reserved') days.set(day, booking.state);
    }
  }

  return [...days]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, state]) => ({ date, state }));
}
