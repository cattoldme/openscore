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

- Frontend: Next.js, TypeScript, Tailwind CSS, PWA
- Backend: Hono or NestJS
- Database: PostgreSQL
- Cache: Redis
- Realtime: Server-Sent Events first, WebSocket later if needed
- Jobs: scheduled provider sync tasks
- AI Query: structured data retrieval plus LLM answer generation
- Deployment: Docker Compose for self-hosting, Vercel/Render/Fly.io for hosted demos

## Repository Structure

```text
.
├── README.md
├── LICENSE
├── docs
│   ├── PROJECT_PROPOSAL.md
│   └── ROADMAP.md
└── .gitignore
```

Application code will be added after the product and architecture baseline is confirmed.

## Project Principles

- Keep the interface fast and quiet.
- Prefer useful data over noisy content.
- Do not promote gambling or betting behavior.
- Separate data provider logic from product logic.
- Make local development and self-hosting easy.
- Keep the first release small enough to finish.

## Status

OpenScore is at the project planning and repository bootstrapping stage.

See [Project Proposal](docs/PROJECT_PROPOSAL.md) and [Roadmap](docs/ROADMAP.md).

