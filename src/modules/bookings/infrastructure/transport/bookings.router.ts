import { Router, type RequestHandler } from 'express';
import { CreateBookingUseCase } from '../../domain/create-booking.use-case';
import { ListBookingsUseCase } from '../../domain/list-bookings.use-case';
import { GetBookingByIdUseCase } from '../../domain/get-booking-by-id.use-case';
import { UpdateBookingUseCase } from '../../domain/update-booking.use-case';
import { ChangeBookingStateUseCase } from '../../domain/change-booking-state.use-case';
import { DeleteBookingUseCase } from '../../domain/delete-booking.use-case';
import { CheckAvailabilityUseCase } from '../../domain/check-availability.use-case';
import { ListOccupiedDaysUseCase } from '../../domain/list-occupied-days.use-case';
import { ValidationError, NotFoundError, ConflictError } from '../../domain/errors';
import type { BookingState } from '../../domain/booking.interface';

interface BookingsRouterDeps {
  requireAuth: RequestHandler;
  createBooking: CreateBookingUseCase;
  listBookings: ListBookingsUseCase;
  getBookingById: GetBookingByIdUseCase;
  updateBooking: UpdateBookingUseCase;
  changeBookingState: ChangeBookingStateUseCase;
  deleteBooking: DeleteBookingUseCase;
  checkAvailability: CheckAvailabilityUseCase;
  listOccupiedDays: ListOccupiedDaysUseCase;
}

export function BookingsRouter({
  requireAuth,
  createBooking,
  listBookings,
  getBookingById,
  updateBooking,
  changeBookingState,
  deleteBooking,
  checkAvailability,
  listOccupiedDays,
}: BookingsRouterDeps): Router {
  const router = Router();

  // Pública: la web municipal pinta con ella el calendario del refugio. Va antes
  // de '/:id' y solo expone la fecha y el estado de cada día ocupado.
  router.get('/availability', async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    try {
      const availability = await listOccupiedDays.execute(from, to);
      res.status(200).json(availability);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.get('/', requireAuth, async (req, res) => {
    try {
      // ?date= consulta la disponibilidad de un día concreto.
      if (typeof req.query.date === 'string') {
        const date = req.query.date;
        const available = await checkAvailability.execute(date);
        res.status(200).json({ date, available });
        return;
      }

      const state =
        typeof req.query.state === 'string' ? (req.query.state as BookingState) : undefined;
      const bookings = await listBookings.execute(state);
      res.status(200).json(bookings);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.get('/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const booking = await getBookingById.execute(id);
      res.status(200).json(booking);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.post('/', requireAuth, async (req, res) => {
    // Sin body parseable (Content-Type que no sea JSON) req.body llega undefined:
    // sin este fallback, leer sus campos lanzaría y respondería un 500 en vez de un 400.
    const body = req.body ?? {};
    try {
      const booking = await createBooking.execute({
        name: body.name,
        phone: body.phone,
        startDate: body.startDate,
        endDate: body.endDate,
        notes: body.notes,
      });

      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof ConflictError) {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.put('/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body ?? {};
    try {
      const booking = await updateBooking.execute(id, {
        name: body.name,
        phone: body.phone,
        startDate: body.startDate,
        endDate: body.endDate,
        state: body.state,
        notes: body.notes,
      });

      res.status(200).json(booking);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ConflictError) {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.patch('/:id/state', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const booking = await changeBookingState.execute(id, (req.body ?? {}).state);

      res.status(200).json(booking);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
      await deleteBooking.execute(id);

      res.status(204).send();
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}
