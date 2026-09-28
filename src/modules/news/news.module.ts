import type { RequestHandler, Router } from 'express';
import type { NewsRepository } from './infrastructure/persistence/news.repository';
import { InMemoryNewsRepository } from './infrastructure/persistence/news.repository';
import { PrismaNewsRepository } from './infrastructure/persistence/prisma-news.repository';
import { getPrisma } from '../../db/prisma';
import { CreateNewsUseCase } from './domain/create-news.use-case';
import { ListNewsUseCase } from './domain/list-news.use-case';
import { GetNewsByIdUseCase } from './domain/get-news-by-id.use-case';
import { UpdateNewsUseCase } from './domain/update-news.use-case';
import { DeleteNewsUseCase } from './domain/delete-news.use-case';
import { NewsRouter } from './infrastructure/transport/noticias.router';

// Selecciona la implementación de persistencia. Por defecto, en memoria (los
// tests no tocan ninguna base de datos). Con PERSISTENCE=prisma usa la base de datos.
function createNewsRepository(): NewsRepository {
  if (process.env.PERSISTENCE === 'prisma') {
    return new PrismaNewsRepository(getPrisma());
  }
  return new InMemoryNewsRepository();
}

export function buildNewsRouter(requireAuth: RequestHandler): Router {
  const repository = createNewsRepository();

  return NewsRouter({
    requireAuth,
    createNew: new CreateNewsUseCase(repository),
    listNews: new ListNewsUseCase(repository),
    getNewsById: new GetNewsByIdUseCase(repository),
    updateNews: new UpdateNewsUseCase(repository),
    deleteNews: new DeleteNewsUseCase(repository),
  });
}
