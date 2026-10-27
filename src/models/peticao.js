import mongoose from 'mongoose'

const peticaoSchema = new mongoose.Schema({
  pet_id: { type: String, required: true, unique: true },
  leg: { type: String, required: true },
  numero: Number,
  assunto: String,
  autor: String,
  data_entrada: Date,
  assinaturas: Number,
  assinaturas_inicial: Number,
  situacao: String,
  url_texto: String,
  data_debate: Date,
  comissao: {
    nome: String,
    situacao: String,
    admissibilidade: String,
    data_admissibilidade: Date,
    relatores: [String]
  },
  documentos: [{
    _id: false,
    titulo: String,
    tipo: String,
    data: Date,
    url: String
  }],
  iniciativas_originadas: [mongoose.Schema.Types.Mixed],
  synced_at: { type: Date, default: Date.now }
}, { collection: 'peticoes' })

peticaoSchema.index({ leg: 1, data_entrada: -1 })
peticaoSchema.index({ situacao: 1 })
peticaoSchema.index({ assinaturas: -1 })
peticaoSchema.index({ assunto: 'text' }, { default_language: 'portuguese' })

export const Peticao = mongoose.model('Peticao', peticaoSchema)
