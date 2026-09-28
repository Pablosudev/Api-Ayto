import { Router, type RequestHandler } from 'express';
import { createUploadForm, rutaPublica } from '../../../../utils/uploads';
import { CreateNewsUseCase } from '../../domain/create-news.use-case';
import { ListNewsUseCase } from '../../domain/list-news.use-case';
import { GetNewsByIdUseCase } from '../../domain/get-news-by-id.use-case';
import { UpdateNewsUseCase } from '../../domain/update-news.use-case';
import { DeleteNewsUseCase } from '../../domain/delete-news.use-case';
import { ValidationError, NotFoundError } from '../../domain/errors';

// Capa de TRANSPORTE.
// Todo lo relacionado con HTTP/Express vive aquí: parseo de la petición
// (multipart/form-data), traducción de errores de dominio a códigos HTTP y
// serialización de la respuesta. No contiene reglas de negocio.

// formidable entrega los campos de texto como arrays de strings.
const primerValor = (campo: string | string[] | undefined): string | undefined =>
  Array.isArray(campo) ? campo[0] : campo;

interface NewsRouterDeps {
  requireAuth: RequestHandler;
  createNew: CreateNewsUseCase;
  listNews: ListNewsUseCase;
  getNewsById: GetNewsByIdUseCase;
  updateNews: UpdateNewsUseCase;
  deleteNews: DeleteNewsUseCase;
}

export function NewsRouter({
  requireAuth,
  createNew,
  listNews,
  getNewsById,
  updateNews,
  deleteNews,
}: NewsRouterDeps): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const news = await listNews.execute();
      res.status(200).json(news);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      const news = await getNewsById.execute(id);
      res.status(200).json(news);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.post('/', requireAuth, (req, res) => {
    const form = createUploadForm('news');

    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.status(400).json({ error: 'No se pudo procesar la petición' });
        return;
      }

      // La imagen es opcional; si se ha subido, ya está guardada en uploads/news.
      const fileImage = Array.isArray(files.image) ? files.image[0] : files.image;
      const image = rutaPublica('news', fileImage);

      try {
        const news = await createNew.execute({
          title: primerValor(fields.title),
          description: primerValor(fields.description),
          image,
        });

        res.status(201).json(news);
      } catch (error) {
        if (error instanceof ValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        // Al ser un callback async, un throw aquí no lo captura Express
        // (quedaría como una promesa rechazada sin gestionar), así que
        // respondemos nosotros con un 500.
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    });
  });

  router.put('/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const form = createUploadForm('news');

    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.status(400).json({ error: 'No se pudo procesar la petición' });
        return;
      }

      const fileImage = Array.isArray(files.image) ? files.image[0] : files.image;
      const image = rutaPublica('news', fileImage);

      try {
        const news = await updateNews.execute(id, {
          title: primerValor(fields.title),
          description: primerValor(fields.description),
          image,
        });

        res.status(200).json(news);
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
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
      await deleteNews.execute(id);
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
