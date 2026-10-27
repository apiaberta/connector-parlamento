import mongoose from 'mongoose'

const iniciativaSchema = new mongoose.Schema({
  ini_id: { type: String, required: true, unique: true },
  leg: { type: String, required: true },
  numero: Number,
  sessao: Number,
  tipo: String,
  tipo_desc: String,
  titulo: String,
  epigrafe: String,
  texto_url: String,
  autores_gp: [String],
  autores_deputados: [{
    _id: false,
    id_cadastro: Number,
    nome: String,
    gp: String
  }],
  autor_outro: {
    nome: String,
    sigla: String
  },
  data_entrada: Date,
  estado: String,
  data_ultimo_evento: Date,
  eventos: [{
    _id: false,
    evt_id: String,
    oev_id: String,
    codigo_fase: String,
    fase: String,
    data: Date,
    comissao_nome: String,
    obs: String
  }],
  anexos: [{
    _id: false,
    nome: String,
    url: String
  }],
  votacao_final: {
    data: Date,
    resultado: String
  },
  n_votacoes: { type: Number, default: 0 },
  synced_at: { type: Date, default: Date.now }
}, { collection: 'iniciativas' })

iniciativaSchema.index({ leg: 1, tipo: 1, data_entrada: -1 })
iniciativaSchema.index({ autores_gp: 1 })
iniciativaSchema.index({ 'autores_deputados.id_cadastro': 1 })
iniciativaSchema.index({ estado: 1 })
iniciativaSchema.index({ titulo: 'text', epigrafe: 'text' }, { default_language: 'portuguese' })

export const Iniciativa = mongoose.model('Iniciativa', iniciativaSchema)
