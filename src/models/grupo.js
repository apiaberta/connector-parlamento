import mongoose from 'mongoose'

const grupoSchema = new mongoose.Schema({
  leg: { type: String, required: true },
  sigla: { type: String, required: true },
  nome: String,
  synced_at: { type: Date, default: Date.now }
}, { collection: 'grupos' })

grupoSchema.index({ leg: 1, sigla: 1 }, { unique: true })

export const Grupo = mongoose.model('Grupo', grupoSchema)
