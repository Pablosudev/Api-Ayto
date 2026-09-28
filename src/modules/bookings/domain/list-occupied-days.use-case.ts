import type { OccupiedDayInterface } from './booking.interface';
import type { BookingRepository } from '../infrastructure/persistence/booking.repository';
import { ValidationError } from './errors';
import { isDay, occupiedDays } from './availability';

// Un año basta para el calendario público y evita recorrer rangos arbitrarios.
const MAX_RANGE_DAYS = 366;

export class ListOccupiedDaysUseCase {
  constructor(private readonly repository: BookingRepository) {}

  async execute(
    from?: string,
    to?: string,
  ): Promise<{ from: string; to: string; days: OccupiedDayInterface[] }> {
    if (!from || !to || !isDay(from) || !isDay(to)) {
      throw new ValidationError('Indica from y to con el formato YYYY-MM-DD');
    }
    if (from > to) {
      throw new ValidationError('La fecha from no puede ser posterior a to');
    }
    const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (span >= MAX_RANGE_DAYS) {
      throw new ValidationError(`El rango no puede superar ${MAX_RANGE_DAYS} días`);
    }

    const bookings = await this.repository.findAll();
    return { from, to, days: occupiedDays(bookings, from, to) };
  }
}
