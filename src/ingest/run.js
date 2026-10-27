import { Readable } from 'node:stream'
import { DATASETS, DEFAULT_CURRENT_LEG, INGEST_ORDER } from '../config.js'
import {
  Circulo,
  Deputado,
  Grupo,
  Iniciativa,
  Legislatura,
  Peticao,
  Source,
  Votacao
} from '../models/index.js'
import {
  mapBioPatch,
  mapCirculo,
  mapDeputado,
  mapGrupo,
  mapIniciativa,
  mapLegislatura,
  mapPeticao
} from './map.js'
import { createBatchWriter, deleteStale } from './persist.js'
import { detectCurrentLegFromSource, resolveDatasetFile } from './scrape.js'
import { collectStreamArray, fetchHashed, openRemoteStream, parseSmallJson, streamJsonArray } from './stream.js'

async function touchSource(dataset, leg, patch) {
  await Source.findOneAndUpdate(
    { dataset, leg },
    { $set: patch },
    { upsert: true }
  )
}

async function unchanged(dataset, leg, sha256) {
  const prev = await Source.findOne({ dataset, leg }).lean()
  return Boolean(prev?.sha256 && prev.sha256 === sha256)
}

async function prepareFile(datasetKey, leg, { fetchImpl, logger }) {
  const file = await resolveDatasetFile(datasetKey, leg, { fetchImpl })
  const hashed = await fetchHashed(file.url, { fetchImpl })
  await touchSource(datasetKey, leg, {
    file_name: file.file_name,
    url: file.url,
    bytes: hashed.bytes,
    last_checked: new Date(),
    last_error: null
  })
  if (await unchanged(datasetKey, leg, hashed.sha256)) {
    logger?.info({ dataset: datasetKey, leg, sha256: hashed.sha256 }, 'unchanged, skip parse')
    return { skipped: true, file, hashed }
  }
  return { skipped: false, file, hashed }
}

async function markChanged(dataset, leg, hashed, records) {
  await touchSource(dataset, leg, {
    sha256: hashed.sha256,
    bytes: hashed.bytes,
    records,
    last_changed: new Date(),
    last_checked: new Date(),
    last_error: null
  })
}

async function markError(dataset, leg, err) {
  await touchSource(dataset, leg, {
    last_error: err.message,
    last_checked: new Date()
  })
}

async function loadSmallArray(hashed, url, { fetchImpl }) {
  if (hashed.buffer) return parseSmallJson(hashed.buffer)
  const stream = await openRemoteStream(url, { fetchImpl })
  return collectStreamArray(stream)
}

async function ingestInformacaoBase(leg, runStart, opts) {
  const { fetchImpl, logger, currentLeg } = opts
  const prep = await prepareFile('InformacaoBase', leg, opts)
  if (prep.skipped) return { skipped: true }
  const raw = prep.hashed.buffer
    ? parseSmallJson(prep.hashed.buffer)
    : (await loadSmallArray(prep.hashed, prep.file.url, { fetchImpl }))
  const payload = Array.isArray(raw) ? raw[0] : raw
  const syncedAt = new Date()

  const deputados = (payload?.Deputados || []).map((d) => mapDeputado(d, leg, syncedAt)).filter((d) => d.dep_id != null)
  const grupos = (payload?.GruposParlamentares || []).map((g) => mapGrupo(g, leg, syncedAt)).filter((g) => g.sigla)
  const circulos = (payload?.CirculosEleitorais || []).map((c) => mapCirculo(c, leg, syncedAt)).filter((c) => c.id != null)
  const legis = mapLegislatura(payload?.DetalheLegislatura, payload?.SessoesLegislativas, {
    current: leg === currentLeg,
    syncedAt
  })
  if (legis.leg) {
    if (legis.current) await Legislatura.updateMany({ leg: { $ne: legis.leg } }, { $set: { current: false } })
    await Legislatura.findOneAndUpdate({ leg: legis.leg }, { $set: legis }, { upsert: true })
  }

  const nDep = await createBatchWriter(Deputado, ['dep_id', 'leg'])
  await nDep.pushMany(deputados)
  const depWritten = await nDep.flush()
  const nGp = await createBatchWriter(Grupo, ['leg', 'sigla'])
  await nGp.pushMany(grupos)
  await nGp.flush()
  const nCirc = await createBatchWriter(Circulo, ['leg', 'id'])
  await nCirc.pushMany(circulos)
  await nCirc.flush()

  const staleDep = await deleteStale(Deputado, { leg, runStart })
  const staleGp = await deleteStale(Grupo, { leg, runStart })
  const staleCirc = await deleteStale(Circulo, { leg, runStart })

  await markChanged('InformacaoBase', leg, prep.hashed, depWritten)
  logger?.info({ leg, deputados: depWritten, staleDep, staleGp, staleCirc }, 'InformacaoBase ingested')
  return { records: depWritten, grupos: grupos.length, circulos: circulos.length }
}

async function ingestRegistoBiografico(leg, _runStart, opts) {
  const { fetchImpl, logger } = opts
  const prep = await prepareFile('RegistoBiografico', leg, opts)
  if (prep.skipped) return { skipped: true }
  const rows = await loadSmallArray(prep.hashed, prep.file.url, { fetchImpl })
  const list = Array.isArray(rows) ? rows : []
  let updated = 0
  // Biography is joined by cad_id onto already-ingested deputies.
  for (const raw of list) {
    const patch = mapBioPatch(raw)
    if (patch.cad_id == null) continue
    const r = await Deputado.updateMany(
      { cad_id: patch.cad_id, leg },
      {
        $set: {
          sexo: patch.sexo,
          data_nascimento: patch.data_nascimento,
          profissao: patch.profissao,
          habilitacoes: patch.habilitacoes,
          cargos: patch.cargos,
          legislaturas: patch.legislaturas
        }
      }
    )
    updated += r.modifiedCount || 0
  }
  await markChanged('RegistoBiografico', leg, prep.hashed, list.length)
  logger?.info({ leg, bios: list.length, updated }, 'RegistoBiografico ingested')
  return { records: list.length, updated }
}

async function ingestPeticoes(leg, runStart, opts) {
  const { fetchImpl, logger } = opts
  const prep = await prepareFile('Peticoes', leg, opts)
  if (prep.skipped) return { skipped: true }
  const rows = await loadSmallArray(prep.hashed, prep.file.url, { fetchImpl })
  const list = Array.isArray(rows) ? rows : []
  const syncedAt = new Date()
  const docs = list.map((r) => mapPeticao(r, syncedAt)).filter((d) => d.pet_id)
  const writer = createBatchWriter(Peticao, ['pet_id'])
  await writer.pushMany(docs)
  const written = await writer.flush()
  const stale = await deleteStale(Peticao, { leg, runStart })
  await markChanged('Peticoes', leg, prep.hashed, written)
  logger?.info({ leg, records: written, stale }, 'Peticoes ingested')
  return { records: written, stale }
}

async function ingestIniciativas(leg, runStart, opts) {
  const { fetchImpl, logger } = opts
  const prep = await prepareFile('Iniciativas', leg, opts)
  if (prep.skipped) return { skipped: true }

  const syncedAt = new Date()
  const iniWriter = createBatchWriter(Iniciativa, ['ini_id'])
  const votWriter = createBatchWriter(Votacao, ['vot_id'])
  let records = 0

  const source = prep.hashed.buffer
    ? Readable.from(prep.hashed.buffer)
    : await openRemoteStream(prep.file.url, { fetchImpl })

  try {
    for await (const raw of streamJsonArray(source)) {
      const mapped = mapIniciativa(raw, syncedAt)
      if (!mapped.doc.ini_id) continue
      await iniWriter.push(mapped.doc)
      await votWriter.pushMany(mapped.votes)
      records++
    }
    const iniWritten = await iniWriter.flush()
    const votWritten = await votWriter.flush()
    const staleIni = await deleteStale(Iniciativa, { leg, runStart })
    const staleVot = await deleteStale(Votacao, { leg, runStart })
    await markChanged('Iniciativas', leg, prep.hashed, iniWritten)
    logger?.info({ leg, iniciativas: iniWritten, votacoes: votWritten, staleIni, staleVot }, 'Iniciativas ingested')
    return { records: iniWritten, votacoes: votWritten, staleIni, staleVot }
  } catch (err) {
    logger?.error({ err, leg, records }, 'Iniciativas parse failed; skipping stale delete')
    throw err
  }
}

const HANDLERS = {
  InformacaoBase: ingestInformacaoBase,
  RegistoBiografico: ingestRegistoBiografico,
  Peticoes: ingestPeticoes,
  Iniciativas: ingestIniciativas
}

export async function ingestLegislatura(leg, opts = {}) {
  const runStart = opts.runStart || new Date()
  const logger = opts.logger
  const results = {}
  for (const key of INGEST_ORDER) {
    if (!DATASETS[key]) continue
    try {
      results[key] = await HANDLERS[key](leg, runStart, opts)
    } catch (err) {
      await markError(key, leg, err)
      logger?.error({ err, dataset: key, leg }, 'dataset ingest failed')
      results[key] = { error: err.message }
      // Keep going for lighter datasets; stop after a failed Iniciativas so we don't claim success.
      if (key === 'Iniciativas') throw err
    }
  }
  return results
}

export async function ingestLegs(legs, opts = {}) {
  const currentLeg = opts.currentLeg
    || await detectCurrentLegFromSource({ fetchImpl: opts.fetchImpl }).catch(() => DEFAULT_CURRENT_LEG)
    || DEFAULT_CURRENT_LEG
  const out = { currentLeg, legs: {} }
  for (const leg of legs) {
    out.legs[leg] = await ingestLegislatura(leg, { ...opts, currentLeg })
  }
  return out
}
