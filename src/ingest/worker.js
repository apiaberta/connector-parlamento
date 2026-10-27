import mongoose from 'mongoose'
import { MONGO_URI } from '../config.js'
import { ingestLegs } from './run.js'

export async function runWorkerJob(payload = {}) {
  const mongoUri = payload.mongoUri || process.env.MONGO_URI || MONGO_URI
  await mongoose.connect(mongoUri)
  try {
    return await ingestLegs(payload.legs || [], {
      currentLeg: payload.currentLeg,
      logger: {
        info: (obj, msg) => process.send?.({ type: 'log', level: 'info', obj, msg }),
        error: (obj, msg) => process.send?.({ type: 'log', level: 'error', obj: { ...obj, err: obj?.err?.message }, msg })
      }
    })
  } finally {
    await mongoose.disconnect()
  }
}

function send(msg) {
  if (typeof process.send === 'function') process.send(msg)
}

if (typeof process.send === 'function') {
  process.on('message', async (payload) => {
    try {
      const result = await runWorkerJob(payload || {})
      send({ type: 'done', result })
      process.exit(0)
    } catch (err) {
      send({ type: 'error', error: err.message })
      process.exit(1)
    }
  })
}
