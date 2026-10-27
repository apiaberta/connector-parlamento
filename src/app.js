import Fastify from 'fastify'
import { SERVICE_NAME, VERSION } from './config.js'
import { metaRoutes } from './meta.js'
import { parlamentoRoutes } from './routes.js'
import { createMongoStore } from './store.js'

export async function buildApp(opts = {}) {
  const logger = opts.logger === undefined
    ? {
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined
    }
    : opts.logger

  const app = Fastify({ logger })
  app.decorate('db', opts.db || createMongoStore())

  app.get('/health', async () => ({
    status: 'ok',
    service: SERVICE_NAME,
    version: VERSION,
    timestamp: new Date().toISOString()
  }))

  await app.register(metaRoutes)
  await app.register(parlamentoRoutes, { prefix: '/parlamento' })
  return app
}
