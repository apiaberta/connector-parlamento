import mongoose from 'mongoose'
import cron from 'node-cron'
import { buildApp } from './app.js'
import { MONGO_URI, PORT, SERVICE_NAME } from './config.js'
import { triggerIngest } from './ingest/runner.js'
import { Source } from './models/source.js'

const app = await buildApp()

await mongoose.connect(MONGO_URI)
app.log.info('Connected to MongoDB')

cron.schedule('0 5 * * *', async () => {
  app.log.info('Cron: daily parlamento ingest (current legislatura)')
  try {
    const r = await triggerIngest('daily', app.log)
    app.log.info({ r }, 'Daily ingest complete')
  } catch (err) {
    app.log.error({ err }, 'Daily ingest failed')
  }
})

cron.schedule('30 5 * * 0', async () => {
  app.log.info('Cron: weekly parlamento backfill')
  try {
    const r = await triggerIngest('weekly', app.log)
    app.log.info({ r }, 'Weekly backfill complete')
  } catch (err) {
    app.log.error({ err }, 'Weekly backfill failed')
  }
})

const existing = await Source.estimatedDocumentCount()
if (existing === 0) {
  app.log.info('No sources yet; starting first ingest in background')
  triggerIngest('daily', app.log)
    .then((r) => app.log.info({ r }, 'Initial ingest done'))
    .catch((err) => app.log.error({ err }, 'Initial ingest failed'))
}

await app.listen({ port: PORT, host: '0.0.0.0' })
app.log.info(`${SERVICE_NAME} listening on port ${PORT}`)
