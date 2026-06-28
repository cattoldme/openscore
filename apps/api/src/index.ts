import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { loadServerEnv } from "@openscore/config";
import {
  findCompetitionById,
  findMatchById,
  findTeamById,
  getCompetitionStandings,
  getLiveMatches,
  getMatchList,
  getTeamForm,
  mockCompetitions,
  mockSports
} from "@openscore/providers";

const env = loadServerEnv();
const app = new Hono();

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

app.get("/sports", (c) => c.json({ data: mockSports, meta: buildMeta() }));

app.get("/competitions", (c) =>
  c.json({ data: mockCompetitions, meta: buildMeta() })
);

app.get("/competitions/:id/standings", (c) => {
  const competition = findCompetitionById(c.req.param("id"));

  if (!competition) {
    return c.json(notFound("COMPETITION_NOT_FOUND", "Competition not found."), 404);
  }

  return c.json({
    data: {
      competition,
      rows: getCompetitionStandings(competition.id)
    },
    meta: buildMeta()
  });
});

app.get("/matches/today", (c) => {
  const matches = getMatchList({ date: "today" });

  return c.json({
    data: {
      date: new Date().toISOString().slice(0, 10),
      matches
    },
    meta: buildMeta()
  });
});

app.get("/matches", (c) => {
  const status = c.req.query("status");

  return c.json({
    data: getMatchList({ status }),
    meta: buildMeta()
  });
});

app.get("/matches/:id", (c) => {
  const match = findMatchById(c.req.param("id"));

  if (!match) {
    return c.json(notFound("MATCH_NOT_FOUND", "Match not found."), 404);
  }

  return c.json({ data: match, meta: buildMeta() });
});

app.get("/teams/:id", (c) => {
  const team = findTeamById(c.req.param("id"));

  if (!team) {
    return c.json(notFound("TEAM_NOT_FOUND", "Team not found."), 404);
  }

  return c.json({
    data: {
      team,
      form: getTeamForm(team.id)
    },
    meta: buildMeta()
  });
});

app.get("/teams/:id/form", (c) => {
  const team = findTeamById(c.req.param("id"));

  if (!team) {
    return c.json(notFound("TEAM_NOT_FOUND", "Team not found."), 404);
  }

  return c.json({
    data: {
      teamId: team.id,
      form: getTeamForm(team.id)
    },
    meta: buildMeta()
  });
});

app.get("/live/matches/events", async (c) =>
  streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "snapshot",
      data: JSON.stringify({
        matches: getLiveMatches(),
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
    data: buildMockAiAnswer(query),
    meta: buildMeta()
  });
});

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
    source: "mock",
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

function buildMockAiAnswer(query: string) {
  const liveMatches = getLiveMatches();
  const todayMatches = getMatchList({ date: "today" });

  return {
    query,
    answer:
      liveMatches.length > 0
        ? `当前有 ${liveMatches.length} 场进行中的模拟比赛。OpenScore 已基于本地 mock 数据返回结果，后续会替换为真实数据源。`
        : `今天共有 ${todayMatches.length} 场模拟比赛。当前 AI 查询处于 grounded mock 模式，不会编造外部实时比分。`,
    cards: todayMatches.slice(0, 3),
    grounded: true
  };
}
