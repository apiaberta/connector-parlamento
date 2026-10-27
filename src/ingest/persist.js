import { BULK_BATCH } from '../config.js'

export async function bulkUpsert(Model, docs, keys) {
  if (!docs.length) return 0
  for (let i = 0; i < docs.length; i += BULK_BATCH) {
    const chunk = docs.slice(i, i + BULK_BATCH)
    const ops = chunk.map((doc) => ({
      updateOne: {
        filter: Object.fromEntries(keys.map((k) => [k, doc[k]])),
        update: { $set: doc },
        upsert: true
      }
    }))
    await Model.bulkWrite(ops, { ordered: false })
  }
  return docs.length
}

export function createBatchWriter(Model, keys) {
  let buffer = []
  let written = 0
  return {
    async push(doc) {
      if (!doc) return
      buffer.push(doc)
      if (buffer.length >= BULK_BATCH) {
        const n = await bulkUpsert(Model, buffer, keys)
        written += n
        buffer = []
      }
    },
    async pushMany(docs) {
      for (const doc of docs) await this.push(doc)
    },
    async flush() {
      if (buffer.length) {
        const n = await bulkUpsert(Model, buffer, keys)
        written += n
        buffer = []
      }
      return written
    },
    get written() {
      return written + buffer.length
    }
  }
}

export async function deleteStale(Model, { leg, runStart }) {
  const r = await Model.deleteMany({ leg, synced_at: { $lt: runStart } })
  return r.deletedCount || 0
}
