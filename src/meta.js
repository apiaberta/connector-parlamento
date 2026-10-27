import { ATTRIBUTION, SERVICE_NAME, SOURCE_PAGE, VERSION } from './config.js'

export async function metaRoutes(app) {
  app.get('/parlamento/meta', {
    schema: {
      description: 'Metadata and stats for the Parlamento connector',
      tags: ['Parlamento']
    }
  }, async (req) => {
    const { counts, sources } = await req.server.db.getMeta()
    return {
      connector: SERVICE_NAME,
      version: VERSION,
      description: 'Open data from the Assembleia da República (iniciativas, votações, deputados, petições)',
      source: SOURCE_PAGE,
      attribution: ATTRIBUTION,
      update_freq: 'daily 05:00 (current legislatura)',
      endpoints: [
        { path: '/v1/parlamento/legislaturas', description: 'Known legislaturas and sync state' },
        { path: '/v1/parlamento/iniciativas', description: 'Parliamentary initiatives (trimmed)' },
        { path: '/v1/parlamento/iniciativas/:ini_id', description: 'Initiative plus joined votes' },
        { path: '/v1/parlamento/votacoes', description: 'Votes extracted from initiative events' },
        { path: '/v1/parlamento/votacoes/:vot_id', description: 'Single vote including detalhe_raw' },
        { path: '/v1/parlamento/deputados', description: 'Deputies for a legislatura' },
        { path: '/v1/parlamento/deputados/:dep_id', description: 'Deputy, biography and authorship counts' },
        { path: '/v1/parlamento/grupos', description: 'Parliamentary groups and deputies in office' },
        { path: '/v1/parlamento/peticoes', description: 'Petitions' },
        { path: '/v1/parlamento/peticoes/:pet_id', description: 'Single petition' }
      ],
      counts,
      sources
    }
  })
}
