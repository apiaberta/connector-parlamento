import mongoose from 'mongoose'

const legislaturaSchema = new mongoose.Schema({
  leg: { type: String, required: true, unique: true },
  inicio: Date,
  fim: Date,
  sessoes: [mongoose.Schema.Types.Mixed],
  synced: { type: Boolean, default: false },
  current: { type: Boolean, default: false },
  synced_at: { type: Date, default: Date.now }
}, { collection: 'legislaturas' })

export const Legislatura = mongoose.model('Legislatura', legislaturaSchema)
