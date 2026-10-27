import mongoose from 'mongoose'

const votacaoSchema = new mongoose.Schema({
  vot_id: { type: String, required: true, unique: true },
  ini_id: { type: String, required: true },
  leg: { type: String, required: true },
  data: Date,
  fase: String,
  resultado: String,
  unanime: { type: Boolean, default: false },
  reuniao: mongoose.Schema.Types.Mixed,
  tipo_reuniao: String,
  descricao: String,
  a_favor: [String],
  contra: [String],
  abstencao: [String],
  ausentes: [String],
  deputados_individuais: [String],
  detalhe_raw: String,
  ini_titulo: String,
  ini_tipo: String,
  synced_at: { type: Date, default: Date.now }
}, { collection: 'votacoes' })

votacaoSchema.index({ leg: 1, data: -1 })
votacaoSchema.index({ ini_id: 1 })
votacaoSchema.index({ resultado: 1 })
votacaoSchema.index({ a_favor: 1 })
votacaoSchema.index({ contra: 1 })

export const Votacao = mongoose.model('Votacao', votacaoSchema)
