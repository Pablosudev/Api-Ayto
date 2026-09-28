import express, { type Express } from 'express';
import cors from 'cors';
import { buildNewsRouter } from './modules/news/news.module';
import { buildEventsRouter } from './modules/events/events.module';
import { buildBookingsRouter } from './modules/bookings/bookings.module';
import { buildAuthRouter, createTokenService } from './modules/auth/auth.module';
import { buildJobsRouter } from './modules/jobs/jobs.module';
import { createRequireAuth } from './middleware/auth';
import { UPLOADS_ROOT } from './utils/uploads';

export function createApp(): Express {
  const app = express();

  // El front vive en otro origen (otro puerto), así que el navegador exige CORS.
  // CORS_ORIGIN acepta una lista separada por comas; sin definir, permite
  // cualquier origen (cómodo en desarrollo, conviene acotarlo en producción).
  const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  app.use(cors({ origin: origins?.length ? origins : '*' }));

  app.use(express.json());

  // Endpoints públicos (sin token).
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/auth', buildAuthRouter());

  // Imágenes subidas. Públicas a propósito: el navegador las pide desde un
  // <img src>, que no puede adjuntar el token.
  app.use('/uploads', express.static(UPLOADS_ROOT));

  // Las lecturas de noticias y eventos son públicas, igual que los días ocupados
  // del refugio (sin datos personales); el resto de sus rutas aplica requireAuth
  // dentro del router. Las ofertas de trabajo siguen protegidas por completo.
  const requireAuth = createRequireAuth(createTokenService());
  app.use('/news', buildNewsRouter(requireAuth));
  app.use('/events', buildEventsRouter(requireAuth));
  app.use('/bookings', buildBookingsRouter(requireAuth));
  app.use('/jobs', requireAuth, buildJobsRouter());

  return app;
}
