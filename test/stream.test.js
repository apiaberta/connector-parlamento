import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/stream-array.js'
import { collectStreamArray, streamJsonArray, stripBomTransform } from '../src/ingest/stream.js'

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/iniciativas-mini.json')

describe('stream-json parser', () => {
  it('yields 3 iniciativas from the BOM-prefixed mini file through stream-json', async () => {
    const records = await collectStreamArray(createReadStream(fixture))
    assert.equal(records.length, 3)
    assert.deepEqual(records.map((r) => r.IniId), ['INI-100', 'INI-101', 'INI-102'])
    assert.equal(records[0].IniEventos[1].Votacao.length, 2)
  })

  it('exposes the same 3 records via the async generator', async () => {
    const ids = []
    for await (const rec of streamJsonArray(createReadStream(fixture))) {
      ids.push(rec.IniId)
    }
    assert.deepEqual(ids, ['INI-100', 'INI-101', 'INI-102'])
  })

  it('really uses stream-json parser + streamArray', async () => {
    const seen = []
    const pipeline = createReadStream(fixture)
      .pipe(stripBomTransform())
      .pipe(parser.asStream())
      .pipe(streamArray.asStream())
    for await (const item of pipeline) {
      assert.equal(typeof item.key, 'number')
      seen.push(item.value.IniId)
    }
    assert.equal(seen.length, 3)
  })
})
