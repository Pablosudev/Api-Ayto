import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

// Las lecturas de noticias son públicas. Para probar las escrituras obtenemos un
// token del admin semilla y lo enviamos mediante este helper.
let bearer: string;
beforeAll(async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@ayto.local', password: 'admin1234' });
  bearer = `Bearer ${res.body.token}`;
});

const api = {
  post: (url: string) => request(app).post(url).set('Authorization', bearer),
  put: (url: string) => request(app).put(url).set('Authorization', bearer),
  patch: (url: string) => request(app).patch(url).set('Authorization', bearer),
  delete: (url: string) => request(app).delete(url).set('Authorization', bearer),
};

/**
 * Tests de integración para la gestión CRUD de Noticias.
 * Contrato basado en docs/0001-diseno-api.md.
 *
 * Modelo News:
 *  - id: number (autoincremental)
 *  - title: string (requerido)
 *  - description: string (requerido)
 *  - image: string | null (opcional)
 *  - uploadDate: string date-time (autogenerada)
 *
 * Las peticiones de creación/actualización usan multipart/form-data
 * (campos de texto vía .field(), imagen opcional vía .attach()).
 */

// Helper: crea una noticia válida y devuelve la respuesta.
async function crearNoticia(
  title = 'Corte de agua el lunes',
  description = 'El suministro estará cortado de 9h a 14h en la calle Mayor.',
) {
  return api
    .post('/news')
    .field('title', title)
    .field('description', description);
}

describe('Noticias - CRUD', () => {
  describe('POST /news', () => {
    it('crea una noticia y devuelve 201 con el recurso creado', async () => {
      const res = await crearNoticia();

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Corte de agua el lunes',
        description: 'El suministro estará cortado de 9h a 14h en la calle Mayor.',
      });
      expect(typeof res.body.id).toBe('number');
      expect(res.body.uploadDate).toBeDefined();
    });

    it('permite subir una imagen opcional', async () => {
      const res = await api
        .post('/news')
        .field('title', 'Noticia con imagen')
        .field('description', 'Descripción de prueba')
        .attach('image', Buffer.from('fake-image-content'), 'foto.png');

      expect(res.status).toBe(201);
      expect(res.body.image).toBeTruthy();
    });

    it('devuelve 400 si falta el title', async () => {
      const res = await api
        .post('/news')
        .field('description', 'Sin title');

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si falta la description', async () => {
      const res = await api
        .post('/news')
        .field('title', 'Sin description');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /news', () => {
    it('devuelve 200 y un array de noticias', async () => {
      await crearNoticia();

      const res = await request(app).get('/news');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('responde en formato JSON', async () => {
      const res = await request(app).get('/news');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('cada noticia del listado incluye los campos del modelo', async () => {
      const creada = await crearNoticia('Noticia con forma', 'Contenido de prueba');

      const res = await request(app).get('/news');
      const noticia = res.body.find((n: { id: number }) => n.id === creada.body.id);

      expect(noticia).toBeDefined();
      expect(typeof noticia.id).toBe('number');
      expect(typeof noticia.title).toBe('string');
      expect(typeof noticia.description).toBe('string');
      expect(noticia).toHaveProperty('image'); // string | null
      expect(noticia.uploadDate).toBeDefined();
    });

    it('incluye una noticia recién creada con sus datos', async () => {
      const creada = await crearNoticia('Listado específico', 'Aparece en el GET');

      const res = await request(app).get('/news');
      const noticia = res.body.find((n: { id: number }) => n.id === creada.body.id);

      expect(noticia).toMatchObject({
        id: creada.body.id,
        title: 'Listado específico',
        description: 'Aparece en el GET',
      });
    });

    it('devuelve todas las noticias creadas', async () => {
      const primera = await crearNoticia('Primera del recuento', 'Contenido A');
      const segunda = await crearNoticia('Segunda del recuento', 'Contenido B');

      const res = await request(app).get('/news');
      const ids = res.body.map((n: { id: number }) => n.id);

      expect(ids).toContain(primera.body.id);
      expect(ids).toContain(segunda.body.id);
    });
  });

  describe('GET /news/:id', () => {
    it('devuelve 200 y la noticia solicitada', async () => {
      const creada = await crearNoticia('Noticia concreta', 'Contenido');

      const res = await request(app).get(`/news/${creada.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(creada.body.id);
      expect(res.body.title).toBe('Noticia concreta');
      expect(res.body.description).toBe('Contenido');
    });

    it('responde en formato JSON', async () => {
      const creada = await crearNoticia();

      const res = await request(app).get(`/news/${creada.body.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('la noticia devuelta incluye todos los campos del modelo', async () => {
      const creada = await crearNoticia('Con forma', 'Contenido de prueba');

      const res = await request(app).get(`/news/${creada.body.id}`);

      expect(typeof res.body.id).toBe('number');
      expect(typeof res.body.title).toBe('string');
      expect(typeof res.body.description).toBe('string');
      expect(res.body).toHaveProperty('image'); // string | null
      expect(res.body.uploadDate).toBeDefined();
    });

    it('devuelve la noticia correcta cuando hay varias', async () => {
      await crearNoticia('Primera', 'Contenido A');
      const segunda = await crearNoticia('Segunda', 'Contenido B');

      const res = await request(app).get(`/news/${segunda.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(segunda.body.id);
      expect(res.body.title).toBe('Segunda');
    });

    it('devuelve 404 si la noticia no existe', async () => {
      const res = await request(app).get('/news/999999');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /news/:id', () => {
    it('actualiza una noticia existente y devuelve 200', async () => {
      const creada = await crearNoticia('Title original', 'Description original');

      const res = await api
        .put(`/news/${creada.body.id}`)
        .field('title', 'Title actualizado')
        .field('description', 'Description actualizada');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(creada.body.id);
      expect(res.body.title).toBe('Title actualizado');
      expect(res.body.description).toBe('Description actualizada');
    });

    it('persiste el cambio (un GET posterior devuelve los datos actualizados)', async () => {
      const creada = await crearNoticia('Antes', 'Contenido antes');

      await api
        .put(`/news/${creada.body.id}`)
        .field('title', 'Después')
        .field('description', 'Contenido después');

      const res = await request(app).get(`/news/${creada.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Después');
      expect(res.body.description).toBe('Contenido después');
    });

    it('responde en formato JSON', async () => {
      const creada = await crearNoticia();

      const res = await api
        .put(`/news/${creada.body.id}`)
        .field('title', 'Editada')
        .field('description', 'Editada');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('devuelve 400 si los datos son inválidos', async () => {
      const creada = await crearNoticia();

      const res = await api
        .put(`/news/${creada.body.id}`)
        .field('description', 'Falta el title');

      expect(res.status).toBe(400);
    });

    it('devuelve 404 si la noticia no existe', async () => {
      const res = await api
        .put('/news/999999')
        .field('title', 'No existe')
        .field('description', 'No existe');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /news/:id', () => {
    it('elimina una noticia existente y devuelve 204', async () => {
      const creada = await crearNoticia();

      const res = await api.delete(`/news/${creada.body.id}`);

      expect(res.status).toBe(204);

      // Tras eliminarla, ya no debe encontrarse.
      const verificacion = await request(app).get(`/news/${creada.body.id}`);
      expect(verificacion.status).toBe(404);
    });

    it('la noticia eliminada desaparece del listado', async () => {
      const creada = await crearNoticia('Para borrar', 'Contenido');

      await api.delete(`/news/${creada.body.id}`);

      const res = await request(app).get('/news');
      const ids = res.body.map((n: { id: number }) => n.id);
      expect(ids).not.toContain(creada.body.id);
    });

    it('no afecta a otras noticias', async () => {
      const aBorrar = await crearNoticia('A borrar', 'Contenido');
      const superviviente = await crearNoticia('Superviviente', 'Contenido');

      await api.delete(`/news/${aBorrar.body.id}`);

      const res = await request(app).get(`/news/${superviviente.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(superviviente.body.id);
    });

    it('devuelve 404 si la noticia no existe', async () => {
      const res = await api.delete('/news/999999');

      expect(res.status).toBe(404);
    });
  });
});
