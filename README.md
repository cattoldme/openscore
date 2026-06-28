# OpenScore

OpenScore is an open-source, ad-free sports scores and data query product for people who want a clean alternative to commercial live-score apps.

The first version focuses on football scores, fixtures, standings, team form, favorites, and natural-language sports data queries.

## Why OpenScore

Most mature sports score products are powerful, but the user experience is often crowded with ads, betting-oriented content, noisy notifications, and heavy layouts.

OpenScore takes a different path:

- No ads by default
- No gambling or betting funnel
- Open-source first
- Clean mobile-first interface
- Chinese-friendly data explanation
- Self-hostable architecture
- Provider-agnostic sports data layer
- AI-assisted match and team queries

## Product Positioning

OpenScore is not trying to copy Flashscore or SofaScore feature by feature.

It aims to become:

> A clean, open, and AI-friendly sports scores and data query tool.

## MVP Scope

The initial MVP should stay narrow and useful:

- Today's football matches
- Fixtures and results
- League standings
- Team detail pages
- Recent 5-match form
- Favorite teams and matches
- Lightweight match reminders
- Natural-language queries such as:
  - "今晚英超有哪些比赛?"
  - "阿森纳最近状态怎么样?"
  - "皇马近 5 场进了几个球?"

## Data Strategy

OpenScore should support multiple data providers through adapters instead of binding the product to one API.

Candidate sources:

- football-data.org
- TheSportsDB
- OpenLigaDB
- OpenFootball / football.db
- StatsBomb Open Data

Commercial data sources can be added later, but the MVP should prove the experience with free or low-cost providers first.

## Suggested Tech Stack

- Monorepo: pnpm workspace
- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, PWA
- Backend: Hono
- Database: PostgreSQL
- ORM: Prisma
- Cache: Redis
- Realtime: Server-Sent Events first, WebSocket later if needed
- Jobs: scheduled provider sync tasks
- AI Query: structured data retrieval plus LLM answer generation
- Deployment: Docker Compose for self-hosting, Vercel/Render/Fly.io for hosted demos

## Repository Structure

```text
.
├── apps
│   ├── api
│   └── web
├── packages
│   ├── config
│   ├── db
│   ├── domain
│   └── providers
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── .github
│   ├── ISSUE_TEMPLATE
│   ├── workflows
│   └── pull_request_template.md
├── docs
│   ├── PROJECT_PROPOSAL.md
│   ├── ROADMAP.md
│   ├── TECH_STACK.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── DEPLOYMENT.md
│   ├── ENVIRONMENT.md
│   └── DEVELOPMENT.md
├── Dockerfile
├── docker-compose.yml
└── .gitignore
```

## Development

Install dependencies:

```bash
pnpm install
```

Run API and Web locally:

```bash
pnpm dev
```

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Browser API: `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`

Verify:

```bash
pnpm db:validate
pnpm db:generate
pnpm db:seed:dry-run
pnpm typecheck
pnpm build
pnpm smoke:api
pnpm smoke:web
```

Provider configuration:

```bash
SPORTS_REPOSITORY=memory
CACHE_PROVIDER=memory
SPORTS_PROVIDER=mock

# Optional football-data.org provider
SPORTS_PROVIDER=football_data
FOOTBALL_DATA_API_KEY=your-api-key
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_COMPETITIONS=PL

# Optional PostgreSQL repository
SPORTS_REPOSITORY=postgres
CACHE_PROVIDER=redis
```

Database helpers:

```bash
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:seed:dry-run
pnpm db:push
```

Self-host with Docker Compose:

```bash
docker compose up --build
```

Docker Compose keeps local development settings separate: it defaults to PostgreSQL with `COMPOSE_SPORTS_REPOSITORY=postgres`, Redis cache with `COMPOSE_CACHE_PROVIDER=redis`, runs `pnpm db:migrate && pnpm db:seed` before the API starts, and does not reuse local `DATABASE_URL=localhost` or `REDIS_URL=localhost` settings inside containers.

CI runs the same core checks on pushes and pull requests:

- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm db:seed:dry-run`
- `pnpm typecheck`
- `pnpm build`
- `pnpm smoke:api`
- `pnpm smoke:web`

## Project Principles

- Keep the interface fast and quiet.
- Prefer useful data over noisy content.
- Do not promote gambling or betting behavior.
- Separate data provider logic from product logic.
- Make local development and self-hosting easy.
- Keep the first release small enough to finish.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening issues or pull requests. Use the GitHub issue templates for bugs, feature requests, and data provider integrations.

## Status

OpenScore now has the first monorepo prototype, mock product flow, Prisma schema, initial migration, seed script, memory/PostgreSQL repository implementations, memory/Redis cache implementations, Compose database initialization, football-data provider adapter, manual sync status endpoints, grounded natural-language query MVP, CI checks, and open-source contribution templates. Real provider smoke testing still requires a `FOOTBALL_DATA_API_KEY`.

See:

- [Project Proposal](docs/PROJECT_PROPOSAL.md)
- [Tech Stack](docs/TECH_STACK.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data Model](docs/DATA_MODEL.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Environment](docs/ENVIRONMENT.md)
- [Development](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
