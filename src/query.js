import { HEAVY_LIST_MAX, LEG_PATTERN, LIST_DEFAULT, LIST_MAX } from './config.js'

export class QueryError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'QueryError'
    this.statusCode = statusCode
  }
}

export function assertLeg(leg) {
  if (!leg) return
  if (!LEG_PATTERN.test(leg)) {
    throw new QueryError('Invalid leg, expected roman numerals or Constituinte')
  }
}

export function parsePagination(query, { max = LIST_MAX, def = LIST_DEFAULT } = {}) {
  const rawLimit = query.limit == null || query.limit === '' ? def : Number(query.limit)
  const rawOffset = query.offset == null || query.offset === '' ? 0 : Number(query.offset)
  if (!Number.isFinite(rawLimit) || rawLimit < 1) throw new QueryError('Invalid limit')
  if (!Number.isFinite(rawOffset) || rawOffset < 0) throw new QueryError('Invalid offset')
  return {
    limit: Math.min(max, Math.trunc(rawLimit)),
    offset: Math.trunc(rawOffset)
  }
}

export function heavyPagination(query) {
  return parsePagination(query, { max: HEAVY_LIST_MAX, def: LIST_DEFAULT })
}

export function parseDateParam(value, name) {
  if (value == null || value === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new QueryError(`Invalid ${name}`)
  return d
}

export function parseSort(value, allowed, fallback) {
  if (value == null || value === '') return fallback
  if (!allowed[value]) throw new QueryError(`Invalid sort, expected one of ${Object.keys(allowed).join(', ')}`)
  return allowed[value]
}

export const INI_SORTS = {
  '-data_entrada': { data_entrada: -1 },
  data_entrada: { data_entrada: 1 }
}

export const PET_SORTS = {
  '-assinaturas': { assinaturas: -1 },
  assinaturas: { assinaturas: 1 },
  '-data_entrada': { data_entrada: -1 },
  data_entrada: { data_entrada: 1 }
}
