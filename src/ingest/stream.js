import { createHash } from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/stream-array.js'
import { FETCH_TIMEOUT_MS, MAX_DOWNLOAD_BYTES, SMALL_FILE_BYTES, USER_AGENT } from '../config.js'

export function stripBomBuffer(buf) {
  if (!buf || !buf.length) return buf
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return buf.subarray(3)
  return buf
}

export function stripBomText(text) {
  if (text == null) return text
  return String(text).replace(/^\uFEFF/, '')
}

export function stripBomTransform() {
  let first = true
  return new Transform({
    transform(chunk, _enc, cb) {
      if (first) {
        first = false
        if (Buffer.isBuffer(chunk) && chunk.length >= 3
          && chunk[0] === 0xEF && chunk[1] === 0xBB && chunk[2] === 0xBF) {
          chunk = chunk.subarray(3)
        }
      }
      cb(null, chunk)
    }
  })
}

/**
 * Stream-parse a JSON array one element at a time via stream-json.
 * Never JSON.parse()s the whole document.
 */
export async function* streamJsonArray(readable) {
  const input = readable instanceof Readable ? readable : Readable.from(readable)
  const pipeline = input.pipe(stripBomTransform()).pipe(parser.asStream()).pipe(streamArray.asStream())
  for await (const item of pipeline) {
    yield item.value
  }
}

export async function collectStreamArray(readable) {
  const out = []
  for await (const value of streamJsonArray(readable)) out.push(value)
  return out
}

export async function fetchHashed(url, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > MAX_DOWNLOAD_BYTES) {
    throw new Error(`download exceeds ${MAX_DOWNLOAD_BYTES} byte cap`)
  }

  const hash = createHash('sha256')
  let bytes = 0
  const chunks = []
  const reader = res.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_DOWNLOAD_BYTES) {
      reader.cancel()
      throw new Error(`download exceeds ${MAX_DOWNLOAD_BYTES} byte cap`)
    }
    hash.update(value)
    if (bytes <= SMALL_FILE_BYTES) chunks.push(Buffer.from(value))
  }

  return {
    url,
    sha256: hash.digest('hex'),
    bytes,
    buffer: bytes <= SMALL_FILE_BYTES ? Buffer.concat(chunks) : null
  }
}

export async function openRemoteStream(url, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return Readable.fromWeb(res.body)
}

export function parseSmallJson(buffer) {
  const text = stripBomText(Buffer.from(stripBomBuffer(buffer)).toString('utf8'))
  return JSON.parse(text)
}
