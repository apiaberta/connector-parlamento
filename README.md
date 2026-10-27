# API Aberta — Parlamento Connector

Microservice that fetches and serves open data from the Assembleia da República.

Attribution: **Assembleia da República**.
Source and licence: [Dados Abertos da AR](https://www.parlamento.pt/Cidadania/Paginas/DadosAbertos.aspx).

## Features

- Iniciativas (including votes extracted from `IniEventos`)
- Deputados, grupos parlamentares and círculos
- Petições
- Daily ingest of the current legislatura (`0 5 * * *`)
- Weekly change-check of `PARL_BACKFILL` (default `XVI`) on Sunday 05:30
- Heavy parsing in a forked child (`--max-old-space-size=320`) using `stream-json`

## Endpoints

- `GET /health` — Service health check
- `GET /parlamento/meta` — Counts, sources and update frequency
- `GET /parlamento/legislaturas` — Known legislaturas
- `GET /parlamento/iniciativas` — Initiatives (trimmed; no `eventos`)
- `GET /parlamento/iniciativas/:ini_id` — Full initiative plus joined votes
- `GET /parlamento/votacoes` — Votes
- `GET /parlamento/votacoes/:vot_id` — Single vote
- `GET /parlamento/deputados` — Deputies (default: current legislatura)
- `GET /parlamento/deputados/:dep_id` — Deputy, biography and authorship counts
- `GET /parlamento/grupos` — Groups plus deputies in office
- `GET /parlamento/peticoes` — Petitions
- `GET /parlamento/peticoes/:pet_id` — Single petition

List endpoints return `{count,total,data}`. `limit` max is 200 for iniciativas and votações, 1000 otherwise.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3019` | |
| `MONGO_URI` | `mongodb://localhost:27017/apiaberta-parlamento` | |
| `PARL_BACKFILL` | `XVI` | Comma-separated older legislaturas (weekly) |
| `PARL_CURRENT_LEG` | `XVII` | Fallback if the dataset page cannot be scraped |

pm2 name: `apiaberta-parlamento`. `max_memory_restart`: 300M.

## License

MIT
