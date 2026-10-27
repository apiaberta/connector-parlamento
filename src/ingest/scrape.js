import { DATASETS, LEG_LINK_RE, USER_AGENT, FETCH_TIMEOUT_MS } from '../config.js'
import { unescapeHtml, stripTags } from './parse.js'

const ANCHOR_RE = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi

export function extractAnchors(html) {
  const out = []
  const src = String(html || '')
  for (const m of src.matchAll(ANCHOR_RE)) {
    out.push({
      href: unescapeHtml(m[1]),
      text: stripTags(m[2])
    })
  }
  return out
}

export function resolveHref(href, base) {
  if (!href) return href
  try {
    return new URL(href, base).href
  } catch {
    return href
  }
}

export function findLegislaturaLinks(html, pageUrl) {
  return extractAnchors(html)
    .map((a) => {
      const m = a.text.match(LEG_LINK_RE)
      if (!m) return null
      const leg = a.text === 'Constituinte' ? 'Constituinte' : m[1]
      return {
        leg,
        text: a.text,
        href: resolveHref(a.href, pageUrl),
        kind: a.text === 'Constituinte' ? 'constituinte' : 'legislatura'
      }
    })
    .filter(Boolean)
}

export function detectCurrentLeg(html, pageUrl) {
  const links = findLegislaturaLinks(html, pageUrl)
  return links.find((l) => l.kind === 'legislatura')?.leg || links[0]?.leg || null
}

export function findJsonFileLink(html, filePrefix, leg, pageUrl) {
  const expected = new RegExp(`^${escapeRe(filePrefix)}${escapeRe(leg)}_json\\.txt$`)
  const hit = extractAnchors(html).find((a) => expected.test(a.text))
  if (!hit) return null
  return {
    file_name: hit.text,
    url: resolveHref(hit.href, pageUrl)
  }
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function fetchText(url, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

export async function resolveDatasetFile(datasetKey, leg, { fetchImpl = fetch } = {}) {
  const dataset = DATASETS[datasetKey]
  if (!dataset) throw new Error(`Unknown dataset ${datasetKey}`)
  const pageHtml = await fetchText(dataset.page, { fetchImpl })
  const links = findLegislaturaLinks(pageHtml, dataset.page)
  const hit = links.find((l) => l.leg === leg)
  if (!hit) throw new Error(`Legislatura ${leg} not listed on ${dataset.page}`)
  const subHtml = await fetchText(hit.href, { fetchImpl })
  const file = findJsonFileLink(subHtml, dataset.filePrefix, leg, hit.href)
  if (!file) {
    throw new Error(`JSON file ${dataset.filePrefix}${leg}_json.txt not found for ${leg}`)
  }
  return file
}

export async function detectCurrentLegFromSource({ fetchImpl = fetch } = {}) {
  const page = DATASETS.Iniciativas.page
  const html = await fetchText(page, { fetchImpl })
  return detectCurrentLeg(html, page)
}
