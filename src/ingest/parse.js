const LABEL_KEY = {
  'a favor': 'a_favor',
  contra: 'contra',
  abstencao: 'abstencao',
  ausencia: 'ausentes',
  ausencias: 'ausentes'
}

export function unescapeHtml(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function stripTags(value) {
  return unescapeHtml(String(value || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

export function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function toInt(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export function toStr(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  const s = String(value).trim()
  return s || null
}

export function parseDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const s = String(value).trim()
  if (!s) return null
  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:[T\s].*)?$/)
  if (dmy) {
    const d = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isIndividualDeputy(item) {
  return /^\d+-/.test(item)
}

/**
 * Parse AR vote `detalhe` HTML into structured benches.
 * Always keep the raw string separately (caller stores detalhe_raw).
 */
export function parseDetalhe(html) {
  const result = {
    a_favor: [],
    contra: [],
    abstencao: [],
    ausentes: [],
    deputados_individuais: []
  }
  if (html == null || html === '') return result

  const parts = String(html).split(/<BR\s*\/?>/i)
  for (const part of parts) {
    const colon = part.indexOf(':')
    if (colon === -1) continue
    const key = LABEL_KEY[fold(stripTags(part.slice(0, colon)))]
    if (!key) continue
    const rest = part.slice(colon + 1)
    const italic = [...rest.matchAll(/<I>([\s\S]*?)<\/I>/gi)]
      .map((m) => stripTags(m[1]))
      .filter(Boolean)
    const items = italic.length
      ? italic
      : rest.split(',').map((s) => stripTags(s)).filter(Boolean)
    for (const item of items) {
      result[key].push(item)
      if (isIndividualDeputy(item)) result.deputados_individuais.push(item)
    }
  }
  return result
}

export function comissaoNome(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string') return stripTags(value) || null
  if (Array.isArray(value)) return comissaoNome(value[0])
  return toStr(value.Nome || value.nome || value.ComissaoNome || value.comissaoNome)
}

export function asList(value) {
  if (value == null || value === '') return []
  return Array.isArray(value) ? value : [value]
}
