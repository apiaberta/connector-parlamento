import mongoose from 'mongoose'

const sourceSchema = new mongoose.Schema({
  dataset: { type: String, required: true },
  leg: { type: String, required: true },
  file_name: String,
  url: String,
  sha256: String,
  bytes: Number,
  records: Number,
  last_checked: Date,
  last_changed: Date,
  last_error: String
}, { collection: 'sources' })

sourceSchema.index({ dataset: 1, leg: 1 }, { unique: true })

export const Source = mongoose.model('Source', sourceSchema)
