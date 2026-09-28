import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

/**
 * Tests de integración (TDD) para el sistema de Autenticación.
 * Contrato basado en docs/0001-diseno-api.md, sección 1.
 *
 * Autenticación por JWT (token firmado). El login lo usan los administradores
 * del ayuntamiento.
 *
 * Modelo Usuario administrador:
 *  - id: number (autoincremental)
 *  - email: string (único, requerido)
 *  - passwordHash: string (hash; NUNCA se devuelve en las respuestas)
 *  - name: string (requerido)
 *  - createDate: string date-time (autogenerada)
 *
 * Endpoints:
 *  - POST /auth/login  → público. Recibe { email, password }, devuelve { token, user }
 *  - POST /auth/logout → requiere token. Cierra la sesión del cliente
 *  - GET  /auth/me     → requiere token. Devuelve el usuario autenticado
 *
 * Regla de acceso: los endpoints requieren token JWT válido salvo
 * `POST /auth/login`, `GET /health`, las lecturas `GET /news` y `GET /events`
 * y los días ocupados del refugio, `GET /bookings/availability`.
 */

// Credenciales del administrador semilla que la implementación debe crear para
// que estos tests puedan autenticarse. Ajustar aquí y en la semilla si cambian.
const ADMIN = {
  email: 'admin@ayto.local',
  password: 'admin1234',
  name: 'Administrador',
};

// Helper: intenta iniciar sesión y devuelve la respuesta.
async function login(email = ADMIN.email, password = ADMIN.password) {
  return request(app).post('/auth/login').send({ email, password });
}

// Helper: inicia sesión con el admin semilla y devuelve un token válido.
async function getToken(): Promise<string> {
  const res = await login();
  return res.body.token as string;
}

describe('Autenticación', () => {
  describe('POST /auth/login', () => {
    it('devuelve 200 con { token, user } para credenciales válidas', async () => {
      const res = await login();

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
      expect(res.body.user).toBeDefined();
    });

    it('responde en formato JSON', async () => {
      const res = await login();

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('el user devuelto incluye los campos del modelo', async () => {
      const res = await login();

      expect(typeof res.body.user.id).toBe('number');
      expect(res.body.user.email).toBe(ADMIN.email);
      expect(typeof res.body.user.name).toBe('string');
      expect(res.body.user.createDate).toBeDefined();
    });

    it('nunca expone la contraseña ni su hash en la respuesta', async () => {
      const res = await login();

      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('devuelve 401 si la contraseña es incorrecta', async () => {
      const res = await login(ADMIN.email, 'contraseña-incorrecta');

      expect(res.status).toBe(401);
    });

    it('devuelve 401 si el email no existe', async () => {
      const res = await login('noexiste@ayto.local', ADMIN.password);

      expect(res.status).toBe(401);
    });

    it('devuelve 400 si falta el email', async () => {
      const res = await request(app).post('/auth/login').send({ password: ADMIN.password });

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si falta la password', async () => {
      const res = await request(app).post('/auth/login').send({ email: ADMIN.email });

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si el body está vacío', async () => {
      const res = await request(app).post('/auth/login').send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('devuelve 200 y el usuario autenticado con un token válido', async () => {
      const token = await getToken();

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.id).toBe('number');
      expect(res.body.email).toBe(ADMIN.email);
      expect(typeof res.body.name).toBe('string');
    });

    it('no expone la contraseña ni su hash', async () => {
      const token = await getToken();

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('password');
    });

    it('devuelve 401 si no se envía la cabecera Authorization', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
    });

    it('devuelve 401 si el token es inválido', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer token-invalido');

      expect(res.status).toBe(401);
    });

    it('devuelve 401 si la cabecera no usa el esquema Bearer', async () => {
      const token = await getToken();

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', token); // sin el prefijo "Bearer "

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('devuelve 200 con un token válido', async () => {
      const token = await getToken();

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('devuelve 401 si no se envía token', async () => {
      const res = await request(app).post('/auth/logout');

      expect(res.status).toBe(401);
    });
  });

  describe('Regla de acceso (endpoints protegidos)', () => {
    it('GET /health es público: responde 200 sin token', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
    });

    it('GET /news es público: responde 200 sin token', async () => {
      const res = await request(app).get('/news');

      expect(res.status).toBe(200);
    });

    it('POST /news permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).post('/news');

      expect(res.status).toBe(401);
    });

    it('PUT /news/:id permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).put('/news/1');

      expect(res.status).toBe(401);
    });

    it('DELETE /news/:id permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).delete('/news/1');

      expect(res.status).toBe(401);
    });

    it('GET /events es público: responde 200 sin token', async () => {
      const res = await request(app).get('/events');

      expect(res.status).toBe(200);
    });

    it('POST /events permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).post('/events');

      expect(res.status).toBe(401);
    });

    it('PUT /events/:id permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).put('/events/1');

      expect(res.status).toBe(401);
    });

    it('DELETE /events/:id permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).delete('/events/1');

      expect(res.status).toBe(401);
    });

    it('GET /bookings devuelve 401 sin token', async () => {
      const res = await request(app).get('/bookings');

      expect(res.status).toBe(401);
    });

    it('GET /bookings/availability es público: responde 200 sin token', async () => {
      const res = await request(app).get('/bookings/availability?from=2026-10-01&to=2026-10-31');

      expect(res.status).toBe(200);
    });

    it('GET /bookings/:id permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).get('/bookings/1');

      expect(res.status).toBe(401);
    });

    it('POST /bookings permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).post('/bookings');

      expect(res.status).toBe(401);
    });

    it('PUT /bookings/:id permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).put('/bookings/1');

      expect(res.status).toBe(401);
    });

    it('PATCH /bookings/:id/state permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).patch('/bookings/1/state');

      expect(res.status).toBe(401);
    });

    it('DELETE /bookings/:id permanece protegido: devuelve 401 sin token', async () => {
      const res = await request(app).delete('/bookings/1');

      expect(res.status).toBe(401);
    });

    it('GET /jobs devuelve 401 si el token es inválido', async () => {
      const res = await request(app)
        .get('/jobs')
        .set('Authorization', 'Bearer token-invalido');

      expect(res.status).toBe(401);
    });

    it('GET /jobs responde 200 con un token válido', async () => {
      const token = await getToken();

      const res = await request(app)
        .get('/jobs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });
});
