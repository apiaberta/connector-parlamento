import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'

function stubDb(overrides = {}) {
  return {
    currentLeg: async () => 'XVII',
    listLegislaturas: async () => [{ leg: 'XVII', inicio: null, fim: null, sessoes: [], synced: true }],
    listIniciativas: async () => ({ total: 0, data: [] }),
    getIniciativa: async () => null,
    listVotacoes: async () => ({ total: 0, data: [] }),
    getVotacao: async () => null,
    listDeputados: async () => ({ total: 0, data: [] }),
    getDeputado: async () => null,
    listGrupos: async () => [],
    listPeticoes: async () => ({ total: 0, data: [] }),
    getPeticao: async () => null,
    getMeta: async () => ({
      counts: { iniciativas: 0, votacoes: 0, deputados: 0, grupos: 0, circulos: 0, peticoes: 0 },
      sources: []
    }),
    ...overrides
  }
}

describe('routes', () => {
  let app

  before(async () => {
    app = await buildApp({ logger: false, db: stubDb() })
  })

  after(async () => {
    await app.close()
  })

  it('GET /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.status, 'ok')
    assert.equal(body.service, 'connector-parlamento')
    assert.ok(body.timestamp)
  })

  it('GET /parlamento/meta', async () => {
    const res = await app.inject({ method: 'GET', url: '/parlamento/meta' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.update_freq, 'daily 05:00 (current legislatura)')
    assert.equal(body.attribution, 'Assembleia da República')
    assert.equal(body.counts.iniciativas, 0)
  })

  it('returns 400 on a bad leg pattern', async () => {
    for (const url of [
      '/parlamento/iniciativas?leg=foo',
      '/parlamento/iniciativas?leg=17',
      '/parlamento/votacoes?leg=XX17',
      '/parlamento/deputados?leg=bad',
      '/parlamento/peticoes?leg=ABC1'
    ]) {
      const res = await app.inject({ method: 'GET', url })
      assert.equal(res.statusCode, 400, url)
      assert.ok(res.json().error)
    }
  })

  it('accepts roman legs and Constituinte', async () => {
    for (const leg of ['XVII', 'XVI', 'I', 'Constituinte']) {
      const res = await app.inject({ method: 'GET', url: `/parlamento/iniciativas?leg=${leg}` })
      assert.equal(res.statusCode, 200, leg)
      const body = res.json()
      assert.equal(body.count, 0)
      assert.equal(body.total, 0)
      assert.deepEqual(body.data, [])
    }
  })

  it('returns 404s for missing resources', async () => {
    const missing = [
      '/parlamento/iniciativas/does-not-exist',
      '/parlamento/votacoes/does-not-exist',
      '/parlamento/deputados/999999',
      '/parlamento/peticoes/does-not-exist'
    ]
    for (const url of missing) {
      const res = await app.inject({ method: 'GET', url })
      assert.equal(res.statusCode, 404, url)
    }
  })
})
