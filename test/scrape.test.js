import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  detectCurrentLeg,
  extractAnchors,
  findJsonFileLink,
  findLegislaturaLinks
} from '../src/ingest/scrape.js'

const dir = dirname(fileURLToPath(import.meta.url))
const datasetPage = readFileSync(join(dir, 'fixtures/dataset-page.html'), 'utf8')
const legPage = readFileSync(join(dir, 'fixtures/leg-page.html'), 'utf8')
const base = 'https://www.parlamento.pt/Cidadania/Paginas/DAIniciativas.aspx'

describe('link scraper', () => {
  it('picks XVII Legislatura as the current one and unescapes &amp;', () => {
    const links = findLegislaturaLinks(datasetPage, base)
    assert.equal(links[0].leg, 'XVII')
    assert.equal(links[0].text, 'XVII Legislatura')
    assert.match(links[0].href, /Path=encXVII/)
    assert.ok(!links[0].href.includes('&amp;'))
    assert.match(links[0].href, /t=aaa&Path=encXVII/)
    assert.equal(detectCurrentLeg(datasetPage, base), 'XVII')
    assert.deepEqual(links.map((l) => l.leg), ['XVII', 'XVI', 'Constituinte'])
  })

  it('picks IniciativasXVII_json.txt and unescapes the file href', () => {
    const file = findJsonFileLink(legPage, 'Iniciativas', 'XVII', base)
    assert.ok(file)
    assert.equal(file.file_name, 'IniciativasXVII_json.txt')
    assert.equal(
      file.url,
      'https://app.parlamento.pt/webutils/docs/doc.txt?path=BBB&foo=1'
    )
    assert.ok(!file.url.includes('&amp;'))
  })

  it('extracts anchors with unescaped hrefs', () => {
    const anchors = extractAnchors(datasetPage)
    assert.ok(anchors.some((a) => a.href.includes('&Path=') && !a.href.includes('&amp;')))
  })
})
