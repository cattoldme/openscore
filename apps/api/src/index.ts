import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { loadServerEnv } from "@openscore/config";
import { createInMemorySportsRepository, createPrismaClient, createPrismaSportsRepository } from "@openscore/db";
import { createSyncRunner } from "./jobs/sync-jobs";
import { createRedisCache, TtlCache } from "./services/cache";
import { createSportsService } from "./services/sports-service";

const env = loadServerEnv();
const app = new Hono();
const smokeShutdownToken = process.env.OPEN_SCORE_SMOKE_SHUTDOWN_TOKEN;
const repository =
  env.SPORTS_REPOSITORY === "postgres"
    ? createPrismaSportsRepository(createPrismaClient(env.DATABASE_URL))
    : createInMemorySportsRepository();
const cache = env.CACHE_PROVIDER === "redis" ? await createRedisCache(env.REDIS_URL) : new TtlCache();
const sports = createSportsService(env.SPORTS_PROVIDER, {
  repository,
  cache,
  footballData: {
    apiKey: env.FOOTBALL_DATA_API_KEY,
    baseUrl: env.FOOTBALL_DATA_BASE_URL,
    competitionCodes: parseList(env.FOOTBALL_DATA_COMPETITIONS)
  }
});
const syncRunner = createSyncRunner(sports.provider, sports.repository);

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", env.WEB_PUBLIC_BASE_URL],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"]
  })
);

app.get("/health", (c) =>
  c.json({
    data: {
      ok: true,
      service: "openscore-api",
      provider: env.SPORTS_PROVIDER
    },
    meta: buildMeta()
  })
);

app.get("/sports", async (c) => c.json({ data: await sports.listSports(), meta: buildMeta() }));

app.get("/competitions", async (c) =>
  c.json({ data: await sports.listCompetitions(), meta: buildMeta() })
);

app.get("/sync/status", async (c) =>
  c.json({
    data: {
      sync: syncRunner.getSnapshot(),
      repository: await sports.getRepositorySnapshot(),
      cache: await sports.getCacheSnapshot()
    },
    meta: buildMeta()
  })
);

app.post("/sync/run", async (c) => {
  await sports.clearCache();

  return c.json({
    data: await syncRunner.runNow(),
    meta: buildMeta()
  });
});

app.get("/competitions/:id/standings", async (c) => {
  const competition = await sports.getCompetition(c.req.param("id"));

  if (!competition) {
    return c.json(notFound("COMPETITION_NOT_FOUND", "Competition not found."), 404);
  }

  return c.json({
    data: {
      competition,
      rows: await sports.getStandings(competition.id)
    },
    meta: buildMeta()
  });
});

app.get("/matches/today", async (c) => {
  const matches = await sports.listMatches({ date: "today" });

  return c.json({
    data: {
      date: new Date().toISOString().slice(0, 10),
      matches
    },
    meta: buildMeta()
  });
});

app.get("/matches", async (c) => {
  const status = c.req.query("status");

  return c.json({
    data: await sports.listMatches({ status }),
    meta: buildMeta()
  });
});

app.get("/matches/:id", async (c) => {
  const match = await sports.getMatch(c.req.param("id"));

  if (!match) {
    return c.json(notFound("MATCH_NOT_FOUND", "Match not found."), 404);
  }

  return c.json({ data: match, meta: buildMeta() });
});

app.get("/teams/:id", async (c) => {
  const teamId = c.req.param("id");
  const [team, form] = await Promise.all([sports.getTeam(teamId), sports.getTeamForm(teamId)]);

  if (!team) {
    return c.json(notFound("TEAM_NOT_FOUND", "Team not found."), 404);
  }

  return c.json({
    data: {
      team,
      form
    },
    meta: buildMeta()
  });
});

app.get("/teams/:id/form", async (c) => {
  const team = await sports.getTeam(c.req.param("id"));

  if (!team) {
    return c.json(notFound("TEAM_NOT_FOUND", "Team not found."), 404);
  }

  return c.json({
    data: {
      team,
      form: await sports.getTeamForm(team.id)
    },
    meta: buildMeta()
  });
});

app.get("/live/matches/events", async (c) =>
  streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "snapshot",
      data: JSON.stringify({
        matches: await sports.listLiveMatches(),
        updatedAt: new Date().toISOString()
      })
    });
  })
);

app.post("/ai/query", async (c) => {
  const body = await c.req.json().catch(() => undefined);
  const query =
    typeof body === "object" && body !== null && "query" in body && typeof body.query === "string"
      ? body.query.trim()
      : "";

  if (!query) {
    return c.json(
      {
        error: {
          code: "INVALID_QUERY",
          message: "Query is required."
        }
      },
      400
    );
  }

  return c.json({
    data: await sports.answerQuery(query),
    meta: buildMeta()
  });
});

if (smokeShutdownToken) {
  app.post("/__smoke/shutdown", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    const token =
      typeof body === "object" && body !== null && "token" in body && typeof body.token === "string"
        ? body.token
        : "";

    if (token !== smokeShutdownToken) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Invalid smoke shutdown token."
          }
        },
        403
      );
    }

    setTimeout(() => process.exit(0), 50);
    return c.json({ data: { ok: true }, meta: buildMeta() });
  });
}

const port = Number.parseInt(new URL(env.API_BASE_URL).port || "4000", 10);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`OpenScore API listening on http://localhost:${info.port}`);
  }
);

export type ApiApp = typeof app;

function buildMeta() {
  return {
    source: env.SPORTS_PROVIDER,
    updatedAt: new Date().toISOString()
  };
}

function notFound(code: string, message: string) {
  return {
    error: {
      code,
      message
    }
  };
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
