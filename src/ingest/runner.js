import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { BACKFILL_LEGS, DEFAULT_CURRENT_LEG, INGEST_TIMEOUT_MS, MONGO_URI, WORKER_HEAP_MB } from '../config.js'
import { detectCurrentLegFromSource } from './scrape.js'

const WORKER = fileURLToPath(new URL('./worker.js', import.meta.url))

let running = false

export function forkIngest(payload, { timeoutMs = INGEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER, [], {
      execArgv: [`--max-old-space-size=${WORKER_HEAP_MB}`],
      env: { ...process.env }
    })
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(reject, new Error(`ingest timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.on('message', (msg) => {
      if (msg?.type === 'done') finish(resolve, msg.result)
      else if (msg?.type === 'error') finish(reject, new Error(msg.error))
    })
    child.on('error', (err) => finish(reject, err))
    child.on('exit', (code) => {
      if (settled) return
      finish(reject, new Error(`ingest worker exited ${code}`))
    })
    child.send({
      mongoUri: process.env.MONGO_URI || MONGO_URI,
      ...payload
    })
  })
}

export async function triggerIngest(mode, logger) {
  if (running) {
    logger?.warn({ mode }, 'ingest already running')
    return { skipped: true, reason: 'already-running' }
  }
  running = true
  try {
    const currentLeg = await detectCurrentLegFromSource().catch((err) => {
      logger?.warn({ err }, 'could not detect current legislatura, using default')
      return DEFAULT_CURRENT_LEG
    }) || DEFAULT_CURRENT_LEG

    const legs = mode === 'weekly'
      ? BACKFILL_LEGS.filter((l) => l && l !== currentLeg)
      : [currentLeg]

    if (!legs.length) return { skipped: true, reason: 'no-legs', currentLeg }

    logger?.info({ mode, legs, currentLeg }, 'starting parlamento ingest worker')
    const result = await forkIngest({ legs, currentLeg })
    logger?.info({ mode, result }, 'parlamento ingest complete')
    return result
  } catch (err) {
    logger?.error({ err, mode }, 'parlamento ingest failed')
    throw err
  } finally {
    running = false
  }
}
