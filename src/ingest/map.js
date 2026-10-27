import { createHash } from 'node:crypto'
import { asList, comissaoNome, parseDate, parseDetalhe, toInt, toStr } from './parse.js'

function currentOf(rows, startKey, endKey, valueKey) {
  if (!rows.length) return { current: null, historico: rows }
  const open = [...rows].reverse().find((r) => !r[endKey])
  const current = open || rows[rows.length - 1]
  return { current: current?.[valueKey] ?? null, historico: rows }
}

export function votId(rawVote, iniId, data, fase) {
  const id = rawVote?.id
  if (id != null && id !== '') {
    const n = toInt(id)
    return n != null ? String(n) : String(id)
  }
  const iso = data instanceof Date ? data.toISOString() : String(data || '')
  return createHash('sha1').update(`${iniId}|${iso}|${fase || ''}`).digest('hex')
}

export function mapEvento(raw) {
  return {
    evt_id: toStr(raw?.EvtId),
    oev_id: toStr(raw?.OevId),
    codigo_fase: toStr(raw?.CodigoFase),
    fase: toStr(raw?.Fase),
    data: parseDate(raw?.DataFase),
    comissao_nome: comissaoNome(raw?.Comissao),
    obs: toStr(raw?.ObsFase)
  }
}

export function mapVote(rawVote, evento, iniciativa) {
  const detalhe = parseDetalhe(rawVote?.detalhe)
  const data = parseDate(rawVote?.data)
  const fase = toStr(evento?.Fase) || toStr(evento?.fase)
  const iniId = toStr(iniciativa?.IniId)
  return {
    vot_id: votId(rawVote, iniId, data, fase),
    ini_id: iniId,
    leg: toStr(iniciativa?.IniLeg),
    data,
    fase,
    resultado: toStr(rawVote?.resultado),
    unanime: rawVote?.unanime === 'unanime' || rawVote?.unanime === true,
    reuniao: rawVote?.reuniao ?? null,
    tipo_reuniao: toStr(rawVote?.tipoReuniao),
    descricao: toStr(rawVote?.descricao),
    a_favor: detalhe.a_favor,
    contra: detalhe.contra,
    abstencao: detalhe.abstencao,
    ausentes: detalhe.ausentes,
    deputados_individuais: detalhe.deputados_individuais,
    detalhe_raw: rawVote?.detalhe == null ? null : String(rawVote.detalhe),
    ini_titulo: toStr(iniciativa?.IniTitulo),
    ini_tipo: toStr(iniciativa?.IniTipo)
  }
}

export function mapIniciativa(raw, syncedAt = new Date()) {
  const eventosRaw = asList(raw?.IniEventos)
  const eventos = eventosRaw.map(mapEvento)
  const votes = []
  for (const ev of eventosRaw) {
    for (const v of asList(ev?.Votacao)) {
      votes.push(mapVote(v, ev, raw))
    }
  }
  const dated = eventos.filter((e) => e.data)
  dated.sort((a, b) => a.data - b.data)
  const first = dated[0]
  const last = dated[dated.length - 1]
  const lastVote = votes.length ? votes[votes.length - 1] : null

  return {
    doc: {
      ini_id: toStr(raw?.IniId),
      leg: toStr(raw?.IniLeg),
      numero: toInt(raw?.IniNr),
      sessao: toInt(raw?.IniSel),
      tipo: toStr(raw?.IniTipo),
      tipo_desc: toStr(raw?.IniDescTipo),
      titulo: toStr(raw?.IniTitulo),
      epigrafe: toStr(raw?.IniEpigrafe),
      texto_url: toStr(raw?.IniLinkTexto),
      autores_gp: asList(raw?.IniAutorGruposParlamentares)
        .map((g) => toStr(g?.GP || g?.gp || g?.sigla))
        .filter(Boolean),
      autores_deputados: asList(raw?.IniAutorDeputados).map((d) => ({
        id_cadastro: toInt(d?.idCadastro),
        nome: toStr(d?.nome),
        gp: toStr(d?.GP || d?.gp)
      })),
      autor_outro: raw?.IniAutorOutros
        ? {
          nome: toStr(raw.IniAutorOutros.nome),
          sigla: toStr(raw.IniAutorOutros.sigla)
        }
        : null,
      data_entrada: first?.data || parseDate(raw?.DataInicioleg),
      estado: last?.fase || null,
      data_ultimo_evento: last?.data || parseDate(raw?.DataFimleg),
      eventos,
      anexos: asList(raw?.IniAnexos).map((a) => ({
        nome: toStr(a?.anexoNome),
        url: toStr(a?.anexoFich)
      })),
      votacao_final: lastVote ? { data: lastVote.data, resultado: lastVote.resultado } : null,
      n_votacoes: votes.length,
      synced_at: syncedAt
    },
    votes: votes.map((v) => ({ ...v, synced_at: syncedAt }))
  }
}

export function jsonSize(doc) {
  return Buffer.byteLength(JSON.stringify(doc), 'utf8')
}

export function mapDeputado(raw, leg, syncedAt = new Date()) {
  const gps = asList(raw?.DepGP).map((g) => ({
    sigla: toStr(g?.gpSigla),
    inicio: parseDate(g?.gpDtInicio),
    fim: parseDate(g?.gpDtFim)
  }))
  const sits = asList(raw?.DepSituacao).map((s) => ({
    descricao: toStr(s?.sioDes),
    inicio: parseDate(s?.sioDtInicio),
    fim: parseDate(s?.sioDtFim)
  }))
  const gp = currentOf(gps, 'inicio', 'fim', 'sigla')
  const sit = currentOf(sits, 'inicio', 'fim', 'descricao')
  return {
    dep_id: toInt(raw?.DepId),
    cad_id: toInt(raw?.DepCadId),
    leg: toStr(raw?.LegDes) || leg,
    nome: toStr(raw?.DepNomeParlamentar),
    nome_completo: toStr(raw?.DepNomeCompleto),
    circulo_id: toInt(raw?.DepCPId),
    circulo: toStr(raw?.DepCPDes),
    gp_atual: gp.current,
    gp_historico: gp.historico,
    situacao_atual: sit.current,
    situacao_historico: sit.historico,
    cargo: raw?.DepCargo ?? null,
    synced_at: syncedAt
  }
}

export function mapBioPatch(raw) {
  return {
    cad_id: toInt(raw?.CadId),
    sexo: toStr(raw?.CadSexo),
    data_nascimento: parseDate(raw?.CadDtNascimento),
    profissao: toStr(raw?.CadProfissao),
    habilitacoes: asList(raw?.CadHabilitacoes)
      .map((h) => toStr(h?.HabDes))
      .filter(Boolean),
    cargos: asList(raw?.CadCargosFuncoes)
      .map((c) => toStr(c?.FunDes))
      .filter(Boolean),
    legislaturas: asList(raw?.CadDeputadoLegis).map((l) => ({
      leg: toStr(l?.LegDes),
      circulo: toStr(l?.CeDes),
      gp: toStr(l?.GpSigla)
    }))
  }
}

export function mapGrupo(raw, leg, syncedAt = new Date()) {
  return {
    leg,
    sigla: toStr(raw?.sigla),
    nome: toStr(raw?.nome),
    synced_at: syncedAt
  }
}

export function mapCirculo(raw, leg, syncedAt = new Date()) {
  return {
    leg,
    id: toInt(raw?.cpId),
    nome: toStr(raw?.cpDes),
    synced_at: syncedAt
  }
}

export function mapLegislatura(detalhe, sessoes, { current = false, syncedAt = new Date() } = {}) {
  return {
    leg: toStr(detalhe?.sigla) || toStr(detalhe?.id),
    inicio: parseDate(detalhe?.dtini),
    fim: parseDate(detalhe?.dtfim),
    sessoes: asList(sessoes),
    synced: true,
    current,
    synced_at: syncedAt
  }
}

function mapRelatores(value) {
  return asList(value)
    .map((r) => (typeof r === 'string' ? toStr(r) : toStr(r?.nome || r?.Nome || r?.relator)))
    .filter(Boolean)
}

export function mapPeticao(raw, syncedAt = new Date()) {
  const com = asList(raw?.DadosComissao)[0] || null
  return {
    pet_id: toStr(raw?.PetId),
    leg: toStr(raw?.PetLeg),
    numero: toInt(raw?.PetNr),
    assunto: toStr(raw?.PetAssunto),
    autor: toStr(raw?.PetAutor),
    data_entrada: parseDate(raw?.PetDataEntrada),
    assinaturas: toInt(raw?.PetNrAssinaturas),
    assinaturas_inicial: toInt(raw?.PetNrAssinaturasInicial),
    situacao: toStr(raw?.PetSituacao),
    url_texto: toStr(raw?.PetUrlTexto),
    data_debate: parseDate(raw?.DataDebate),
    comissao: com
      ? {
        nome: toStr(com.Nome),
        situacao: toStr(com.Situacao),
        admissibilidade: toStr(com.Admissibilidade),
        data_admissibilidade: parseDate(com.DataAdmissibilidade),
        relatores: mapRelatores(com.Relatores)
      }
      : null,
    documentos: asList(raw?.Documentos).map((d) => ({
      titulo: toStr(d?.TituloDocumento),
      tipo: toStr(d?.TipoDocumento),
      data: parseDate(d?.DataDocumento),
      url: toStr(d?.URL)
    })),
    iniciativas_originadas: asList(raw?.Iniciativasoriginadas || raw?.IniciativasOriginadas),
    synced_at: syncedAt
  }
}
