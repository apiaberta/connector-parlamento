import { DEFAULT_CURRENT_LEG } from './config.js'
import {
  Circulo,
  Deputado,
  Grupo,
  Iniciativa,
  Legislatura,
  Peticao,
  Source,
  Votacao
} from './models/index.js'

const INI_LIST_PROJECTION = '-eventos'

function leanList(docs) {
  return docs.map((d) => {
    const { _id, __v, ...rest } = d
    return rest
  })
}

export function createMongoStore() {
  return {
    async currentLeg() {
      const doc = await Legislatura.findOne({ current: true }).select('leg').lean()
      return doc?.leg || DEFAULT_CURRENT_LEG
    },

    async listLegislaturas() {
      const rows = await Legislatura.find().sort({ inicio: -1 }).lean()
      return rows.map((r) => ({
        leg: r.leg,
        inicio: r.inicio,
        fim: r.fim,
        sessoes: r.sessoes || [],
        synced: Boolean(r.synced)
      }))
    },

    async listIniciativas(filter, { limit, offset, sort }) {
      const [total, data] = await Promise.all([
        Iniciativa.countDocuments(filter),
        Iniciativa.find(filter)
          .select(INI_LIST_PROJECTION)
          .sort(sort)
          .skip(offset)
          .limit(limit)
          .lean()
      ])
      return { total, data: leanList(data) }
    },

    async getIniciativa(iniId) {
      const doc = await Iniciativa.findOne({ ini_id: iniId }).lean()
      if (!doc) return null
      const votacoes = await Votacao.find({ ini_id: iniId }).sort({ data: 1 }).lean()
      const { _id, __v, ...rest } = doc
      return { ...rest, votacoes: leanList(votacoes) }
    },

    async listVotacoes(filter, { limit, offset }) {
      const [total, data] = await Promise.all([
        Votacao.countDocuments(filter),
        Votacao.find(filter).sort({ data: -1 }).skip(offset).limit(limit).lean()
      ])
      return {
        total,
        data: data.map((v) => ({
          vot_id: v.vot_id,
          data: v.data,
          resultado: v.resultado,
          unanime: v.unanime,
          fase: v.fase,
          ini_id: v.ini_id,
          ini_titulo: v.ini_titulo,
          a_favor: v.a_favor,
          contra: v.contra,
          abstencao: v.abstencao
        }))
      }
    },

    async getVotacao(votId) {
      const doc = await Votacao.findOne({ vot_id: votId }).lean()
      if (!doc) return null
      const { _id, __v, ...rest } = doc
      return rest
    },

    async listDeputados(filter, { limit, offset }) {
      const [total, data] = await Promise.all([
        Deputado.countDocuments(filter),
        Deputado.find(filter).sort({ nome: 1 }).skip(offset).limit(limit).lean()
      ])
      return { total, data: leanList(data) }
    },

    async getDeputado(depId, leg) {
      const query = { dep_id: Number(depId) }
      if (leg) query.leg = leg
      let doc = await Deputado.findOne(query).sort({ synced_at: -1 }).lean()
      if (!doc && !leg) doc = await Deputado.findOne({ dep_id: Number(depId) }).lean()
      if (!doc) return null
      const nIni = await Iniciativa.countDocuments({
        'autores_deputados.id_cadastro': doc.cad_id
      })
      const { _id, __v, ...rest } = doc
      return { ...rest, n_iniciativas: nIni }
    },

    async listGrupos(leg) {
      const grupos = await Grupo.find(leg ? { leg } : {}).sort({ sigla: 1 }).lean()
      const out = []
      for (const g of grupos) {
        const n = await Deputado.countDocuments({
          leg: g.leg,
          gp_atual: g.sigla,
          $or: [
            { 'situacao_historico.fim': null },
            { situacao_atual: { $in: ['Efetivo', 'Efectivo', 'Suplente'] } }
          ]
        })
        out.push({
          leg: g.leg,
          sigla: g.sigla,
          nome: g.nome,
          n_deputados: n
        })
      }
      return out
    },

    async listPeticoes(filter, { limit, offset, sort }) {
      const [total, data] = await Promise.all([
        Peticao.countDocuments(filter),
        Peticao.find(filter).sort(sort).skip(offset).limit(limit).lean()
      ])
      return { total, data: leanList(data) }
    },

    async getPeticao(petId) {
      const doc = await Peticao.findOne({ pet_id: petId }).lean()
      if (!doc) return null
      const { _id, __v, ...rest } = doc
      return rest
    },

    async getMeta() {
      const [iniciativas, votacoes, deputados, grupos, circulos, peticoes, sources] = await Promise.all([
        Iniciativa.countDocuments(),
        Votacao.countDocuments(),
        Deputado.countDocuments(),
        Grupo.countDocuments(),
        Circulo.countDocuments(),
        Peticao.countDocuments(),
        Source.find().sort({ dataset: 1, leg: 1 }).lean()
      ])
      return {
        counts: { iniciativas, votacoes, deputados, grupos, circulos, peticoes },
        sources: sources.map((s) => ({
          dataset: s.dataset,
          leg: s.leg,
          file_name: s.file_name,
          sha256: s.sha256,
          bytes: s.bytes,
          records: s.records,
          last_changed: s.last_changed,
          last_checked: s.last_checked,
          last_error: s.last_error
        }))
      }
    }
  }
}
