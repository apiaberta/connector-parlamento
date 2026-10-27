export const SERVICE_NAME = 'connector-parlamento'
export const VERSION = '1.0.0'
export const PORT = parseInt(process.env.PORT || '3019', 10)
export const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/apiaberta-parlamento'

export const USER_AGENT = 'Mozilla/5.0 (compatible; apiaberta.pt/1.0; +https://apiaberta.pt)'
export const SOURCE_PAGE = 'https://www.parlamento.pt/Cidadania/Paginas/DadosAbertos.aspx'
export const ATTRIBUTION = 'Assembleia da República'

export const DEFAULT_CURRENT_LEG = process.env.PARL_CURRENT_LEG || 'XVII'
export const BACKFILL_LEGS = (process.env.PARL_BACKFILL || 'XVI')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const LEG_PATTERN = /^(?:[IVXLC]+|Constituinte)$/
export const LEG_LINK_RE = /^(?:([IVXLC]+) Legislatura|Constituinte)$/

export const MAX_DOWNLOAD_BYTES = 400 * 1024 * 1024
export const SMALL_FILE_BYTES = 5 * 1024 * 1024
export const BULK_BATCH = 500
export const INGEST_TIMEOUT_MS = 15 * 60 * 1000
export const WORKER_HEAP_MB = 320
export const FETCH_TIMEOUT_MS = 180_000

export const LIST_MAX = 1000
export const LIST_DEFAULT = 100
export const HEAVY_LIST_MAX = 200

export const DATASETS = {
  InformacaoBase: {
    key: 'InformacaoBase',
    page: 'https://www.parlamento.pt/Cidadania/Paginas/DAInformacaoBase.aspx',
    filePrefix: 'InformacaoBase'
  },
  RegistoBiografico: {
    key: 'RegistoBiografico',
    page: 'https://www.parlamento.pt/Cidadania/Paginas/DARegistoBiografico.aspx',
    filePrefix: 'RegistoBiografico'
  },
  Peticoes: {
    key: 'Peticoes',
    page: 'https://www.parlamento.pt/Cidadania/Paginas/DAPeticoes.aspx',
    filePrefix: 'Peticoes'
  },
  Iniciativas: {
    key: 'Iniciativas',
    page: 'https://www.parlamento.pt/Cidadania/Paginas/DAIniciativas.aspx',
    filePrefix: 'Iniciativas'
  }
}

export const INGEST_ORDER = [
  'InformacaoBase',
  'RegistoBiografico',
  'Peticoes',
  'Iniciativas'
]
