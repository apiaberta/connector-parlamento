import mongoose from 'mongoose'

const deputadoSchema = new mongoose.Schema({
  dep_id: { type: Number, required: true },
  cad_id: Number,
  leg: { type: String, required: true },
  nome: String,
  nome_completo: String,
  circulo_id: Number,
  circulo: String,
  gp_atual: String,
  gp_historico: [{
    _id: false,
    sigla: String,
    inicio: Date,
    fim: Date
  }],
  situacao_atual: String,
  situacao_historico: [{
    _id: false,
    descricao: String,
    inicio: Date,
    fim: Date
  }],
  cargo: mongoose.Schema.Types.Mixed,
  sexo: String,
  data_nascimento: Date,
  profissao: String,
  habilitacoes: [String],
  cargos: [String],
  legislaturas: [{
    _id: false,
    leg: String,
    circulo: String,
    gp: String
  }],
  synced_at: { type: Date, default: Date.now }
}, { collection: 'deputados' })

deputadoSchema.index({ dep_id: 1, leg: 1 }, { unique: true })
deputadoSchema.index({ cad_id: 1 })
deputadoSchema.index({ gp_atual: 1 })
deputadoSchema.index({ situacao_atual: 1 })
deputadoSchema.index({ nome: 'text' }, { default_language: 'portuguese' })

export const Deputado = mongoose.model('Deputado', deputadoSchema)
