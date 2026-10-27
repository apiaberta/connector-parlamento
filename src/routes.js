import {
  HEAVY_LIST_MAX,
  LIST_DEFAULT,
  LIST_MAX
} from './config.js'
import {
  INI_SORTS,
  PET_SORTS,
  QueryError,
  assertLeg,
  heavyPagination,
  parseDateParam,
  parsePagination,
  parseSort
} from './query.js'

function sendQueryError(err, reply) {
  if (err instanceof QueryError) {
    return reply.code(err.statusCode).send({ error: err.message })
  }
  throw err
}

async function resolveLeg(req, required = false) {
  const raw = req.query.leg
  if (raw) {
    assertLeg(raw)
    return raw
  }
  if (required) return req.server.db.currentLeg()
  const fallback = await req.server.db.currentLeg()
  return fallback
}

export async function parlamentoRoutes(app) {
  app.get('/legislaturas', async (req) => {
    return req.server.db.listLegislaturas()
  })

  app.get('/iniciativas', async (req, reply) => {
    try {
      const leg = await resolveLeg(req)
      const { limit, offset } = heavyPagination(req.query)
      const sort = parseSort(req.query.sort, INI_SORTS, INI_SORTS['-data_entrada'])
      const filter = { leg }
      if (req.query.tipo) filter.tipo = req.query.tipo
      if (req.query.gp) filter.autores_gp = req.query.gp
      if (req.query.deputado) {
        const cad = Number(req.query.deputado)
        if (!Number.isFinite(cad)) throw new QueryError('Invalid deputado')
        filter['autores_deputados.id_cadastro'] = cad
      }
      if (req.query.estado) filter.estado = req.query.estado
      if (req.query.q) filter.$text = { $search: req.query.q }
      const desde = parseDateParam(req.query.desde, 'desde')
      const ate = parseDateParam(req.query.ate, 'ate')
      if (desde || ate) {
        filter.data_entrada = {}
        if (desde) filter.data_entrada.$gte = desde
        if (ate) filter.data_entrada.$lte = ate
      }
      const { total, data } = await req.server.db.listIniciativas(filter, { limit, offset, sort })
      return { count: data.length, total, data }
    } catch (err) {
      return sendQueryError(err, reply)
    }
  })

  app.get('/iniciativas/:ini_id', async (req, reply) => {
    const doc = await req.server.db.getIniciativa(req.params.ini_id)
    if (!doc) return reply.code(404).send({ error: `Iniciativa ${req.params.ini_id} not found` })
    return doc
  })

  app.get('/votacoes', async (req, reply) => {
    try {
      if (req.query.leg) assertLeg(req.query.leg)
      const { limit, offset } = heavyPagination(req.query)
      const filter = {}
      if (req.query.leg) filter.leg = req.query.leg
      if (req.query.ini_id) filter.ini_id = req.query.ini_id
      if (req.query.resultado) filter.resultado = req.query.resultado
      const desde = parseDateParam(req.query.desde, 'desde')
      const ate = parseDateParam(req.query.ate, 'ate')
      if (desde || ate) {
        filter.data = {}
        if (desde) filter.data.$gte = desde
        if (ate) filter.data.$lte = ate
      }
      if (req.query.gp) {
        const sentido = req.query.sentido
        if (sentido && !['a_favor', 'contra', 'abstencao'].includes(sentido)) {
          throw new QueryError('Invalid sentido, expected a_favor|contra|abstencao')
        }
        if (sentido) filter[sentido] = req.query.gp
        else filter.$or = [
          { a_favor: req.query.gp },
          { contra: req.query.gp },
          { abstencao: req.query.gp }
        ]
      }
      const { total, data } = await req.server.db.listVotacoes(filter, { limit, offset })
      return { count: data.length, total, data }
    } catch (err) {
      return sendQueryError(err, reply)
    }
  })

  app.get('/votacoes/:vot_id', async (req, reply) => {
    const doc = await req.server.db.getVotacao(req.params.vot_id)
    if (!doc) return reply.code(404).send({ error: `Votação ${req.params.vot_id} not found` })
    return doc
  })

  app.get('/deputados', async (req, reply) => {
    try {
      const leg = await resolveLeg(req, true)
      const { limit, offset } = parsePagination(req.query, { max: LIST_MAX, def: LIST_DEFAULT })
      const filter = { leg }
      if (req.query.gp) filter.gp_atual = req.query.gp
      if (req.query.circulo) filter.circulo = req.query.circulo
      if (req.query.q) filter.$text = { $search: req.query.q }
      if (req.query.em_funcoes === 'true' || req.query.em_funcoes === true) {
        filter.$or = [
          { situacao_historico: { $elemMatch: { fim: null } } },
          { situacao_atual: { $in: ['Efetivo', 'Efectivo', 'Suplente'] } }
        ]
      }
      const { total, data } = await req.server.db.listDeputados(filter, { limit, offset })
      return { count: data.length, total, data }
    } catch (err) {
      return sendQueryError(err, reply)
    }
  })

  app.get('/deputados/:dep_id', async (req, reply) => {
    try {
      if (req.query.leg) assertLeg(req.query.leg)
      const doc = await req.server.db.getDeputado(req.params.dep_id, req.query.leg)
      if (!doc) return reply.code(404).send({ error: `Deputado ${req.params.dep_id} not found` })
      return doc
    } catch (err) {
      return sendQueryError(err, reply)
    }
  })

  app.get('/grupos', async (req, reply) => {
    try {
      if (req.query.leg) assertLeg(req.query.leg)
      return req.server.db.listGrupos(req.query.leg)
    } catch (err) {
      return sendQueryError(err, reply)
    }
  })

  app.get('/peticoes', async (req, reply) => {
    try {
      if (req.query.leg) assertLeg(req.query.leg)
      const { limit, offset } = parsePagination(req.query, { max: LIST_MAX, def: LIST_DEFAULT })
      const sort = parseSort(req.query.sort, PET_SORTS, PET_SORTS['-assinaturas'])
      const filter = {}
      if (req.query.leg) filter.leg = req.query.leg
      if (req.query.situacao) filter.situacao = req.query.situacao
      if (req.query.q) filter.$text = { $search: req.query.q }
      if (req.query.min_assinaturas) {
        const n = Number(req.query.min_assinaturas)
        if (!Number.isFinite(n)) throw new QueryError('Invalid min_assinaturas')
        filter.assinaturas = { $gte: n }
      }
      const desde = parseDateParam(req.query.desde, 'desde')
      if (desde) filter.data_entrada = { $gte: desde }
      const { total, data } = await req.server.db.listPeticoes(filter, { limit, offset, sort })
      return { count: data.length, total, data }
    } catch (err) {
      return sendQueryError(err, reply)
    }
  })

  app.get('/peticoes/:pet_id', async (req, reply) => {
    const doc = await req.server.db.getPeticao(req.params.pet_id)
    if (!doc) return reply.code(404).send({ error: `Petição ${req.params.pet_id} not found` })
    return doc
  })
}

export { HEAVY_LIST_MAX }
