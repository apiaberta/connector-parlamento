import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDetalhe, toInt } from '../src/ingest/parse.js'
import { jsonSize, mapDeputado, mapIniciativa, mapPeticao } from '../src/ingest/map.js'
import { stripBomText } from '../src/ingest/stream.js'

const fixtures = dirname(fileURLToPath(import.meta.url))

const SAMPLE_FULL = 'A Favor: <I>PSD</I>, <I> PS</I><BR>Contra:<I>CH</I><BR>Abstenção:<I>L</I>, <I> PCP</I>'
const SAMPLE_NO_CONTRA = 'A Favor: <I>PSD</I>, <I>PS</I>, <I>CH</I><BR>Abstenção:<I>L</I>'
const SAMPLE_DEPUTIES = 'A Favor: <I>PSD</I>, <I>1-Maria Silva (CH)</I><BR>Contra:<I>CH</I><BR>Abstenção:<I>PCP</I>'
const SAMPLE_AUSENCIA = 'A Favor: PSD, PS<BR>Contra: CH<BR>Ausência:<I>2-João Costa (IL)</I>'

describe('parseDetalhe', () => {
  it('parses the canonical three-bench sample', () => {
    const d = parseDetalhe(SAMPLE_FULL)
    assert.deepEqual(d.a_favor, ['PSD', 'PS'])
    assert.deepEqual(d.contra, ['CH'])
    assert.deepEqual(d.abstencao, ['L', 'PCP'])
    assert.deepEqual(d.ausentes, [])
    assert.deepEqual(d.deputados_individuais, [])
  })

  it('handles the no-Contra case', () => {
    const d = parseDetalhe(SAMPLE_NO_CONTRA)
    assert.deepEqual(d.a_favor, ['PSD', 'PS', 'CH'])
    assert.deepEqual(d.contra, [])
    assert.deepEqual(d.abstencao, ['L'])
  })

  it('keeps individual deputies in the bench and in deputados_individuais', () => {
    const d = parseDetalhe(SAMPLE_DEPUTIES)
    assert.deepEqual(d.a_favor, ['PSD', '1-Maria Silva (CH)'])
    assert.deepEqual(d.deputados_individuais, ['1-Maria Silva (CH)'])
    assert.deepEqual(d.contra, ['CH'])
  })

  it('parses Ausência and comma lists without <I> tags', () => {
    const d = parseDetalhe(SAMPLE_AUSENCIA)
    assert.deepEqual(d.a_favor, ['PSD', 'PS'])
    assert.deepEqual(d.contra, ['CH'])
    assert.deepEqual(d.ausentes, ['2-João Costa (IL)'])
    assert.deepEqual(d.deputados_individuais, ['2-João Costa (IL)'])
  })
})

describe('numeric normalisation', () => {
  it('turns 15760.0 into 15760', () => {
    assert.equal(toInt(15760.0), 15760)
  })

  it('turns the string "242" into 242', () => {
    assert.equal(toInt('242'), 242)
  })

  it('turns the empty string into null', () => {
    assert.equal(toInt(''), null)
    assert.equal(toInt(null), null)
  })
})

describe('iniciativa trimming', () => {
  it('drops PublicacaoFase / Intervencoesdebates blobs and keeps the doc under 8 KB', () => {
    const bloated = {
      IniId: 'INI-TRIM',
      IniNr: 1,
      IniLeg: 'XVII',
      IniSel: 1,
      IniTipo: 'P',
      IniDescTipo: 'Projeto de Lei',
      IniTitulo: 'Título curto',
      IniEpigrafe: 'Epígrafe',
      IniLinkTexto: 'https://example.test/ini',
      IniAutorGruposParlamentares: [{ GP: 'PS' }],
      IniAutorDeputados: [],
      IniAnexos: [],
      IniEventos: [{
        EvtId: 1,
        OevId: 1,
        CodigoFase: 'ENT',
        Fase: 'Entrada',
        DataFase: '2024-04-01',
        Comissao: { Nome: 'Comissão X', Membros: 'x'.repeat(20_000) },
        PublicacaoFase: 'P'.repeat(20_000),
        Intervencoesdebates: 'I'.repeat(20_000),
        Votacao: []
      }]
    }
    const { doc } = mapIniciativa(bloated)
    const json = JSON.stringify(doc)
    assert.ok(!json.includes('P'.repeat(100)))
    assert.ok(!json.includes('I'.repeat(100)))
    assert.ok(!json.includes('Membros'))
    assert.equal(doc.eventos[0].comissao_nome, 'Comissão X')
    assert.ok(jsonSize(doc) < 8192)
  })
})

describe('mini fixture mapping', () => {
  it('extracts 2 votes from the first mini iniciativa and maps DepId 15760.0', () => {
    const ini = JSON.parse(stripBomText(readFileSync(join(fixtures, 'fixtures/iniciativas-mini.json'), 'utf8')))
    const { doc, votes } = mapIniciativa(ini[0])
    assert.equal(doc.ini_id, 'INI-100')
    assert.equal(doc.n_votacoes, 2)
    assert.equal(votes.length, 2)
    assert.equal(votes[0].vot_id, '9001')
    assert.deepEqual(votes[0].a_favor, ['PSD', 'PS'])
    assert.equal(doc.eventos[0].comissao_nome, 'Comissão de Economia')
    assert.ok(jsonSize(doc) < 8192)

    const info = JSON.parse(readFileSync(join(fixtures, 'fixtures/infobase-mini.json'), 'utf8'))
    const dep = mapDeputado(info.Deputados[0], 'XVII')
    assert.equal(dep.dep_id, 15760)
    assert.equal(dep.cad_id, 2167)
    assert.equal(dep.gp_atual, 'PS')
  })
})

describe('peticao mapping', () => {
  it('normalises assinatura strings and empty inicial', () => {
    const doc = mapPeticao({
      PetId: 'P1',
      PetNr: 1,
      PetLeg: 'XVII',
      PetAssunto: 'Tema',
      PetAutor: 'A',
      PetDataEntrada: '2024-06-01',
      PetNrAssinaturas: '242',
      PetNrAssinaturasInicial: '',
      PetSituacao: 'Aberta'
    })
    assert.equal(doc.assinaturas, 242)
    assert.equal(doc.assinaturas_inicial, null)
  })
})
