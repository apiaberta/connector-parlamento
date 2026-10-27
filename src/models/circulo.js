import mongoose from 'mongoose'

const circuloSchema = new mongoose.Schema({
  leg: { type: String, required: true },
  id: { type: Number, required: true },
  nome: String,
  synced_at: { type: Date, default: Date.now }
}, { collection: 'circulos' })

circuloSchema.index({ leg: 1, id: 1 }, { unique: true })

export const Circulo = mongoose.model('Circulo', circuloSchema)
