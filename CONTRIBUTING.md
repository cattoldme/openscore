# Contributing to OpenScore

Thanks for helping build OpenScore. The project goal is a clean, open-source, ad-free sports scores and data query product.

## Development Setup

Use Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm db:generate
pnpm dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

The default local mode uses mock sports data and the in-memory repository:

```bash
SPORTS_PROVIDER=mock
SPORTS_REPOSITORY=memory
```

## Verification

Before opening a pull request, run:

```bash
pnpm db:validate
pnpm db:generate
pnpm typecheck
pnpm build
```

CI runs the same core checks on pushes and pull requests.

## Contribution Areas

Good first areas:

- Provider adapters
- API normalization
- Mobile-first UI polish
- Self-hosting documentation
- Grounded AI query improvements
- Tests and smoke checks

## Product Principles

- Keep the interface fast and quiet.
- Do not add ads, betting recommendations, or gambling funnels.
- Keep provider-specific logic behind adapters.
- Preserve source attribution and update timestamps for sports data.
- AI answers must be grounded in retrieved structured data.
- Keep the first release small enough to finish.

## Data Providers

Provider work should document:

- API access and rate limits
- Terms and attribution requirements
- Supported sports and competitions
- Status, score, timezone, and ID mapping
- Example payloads when terms allow sharing them

Never commit real API keys. Use local `.env` files or deployment secrets.

## Pull Requests

Keep pull requests focused. Include:

- What changed
- How it was verified
- Any provider, migration, deployment, or UX caveats

If a change needs Docker, PostgreSQL, Redis, or a real provider key and you could not test it locally, say that directly in the PR.
