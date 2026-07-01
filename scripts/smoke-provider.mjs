import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

loadDotEnv();
const provider = process.env.OPEN_SCORE_PROVIDER_SMOKE_PROVIDER ?? "openligadb";
const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();

if (provider === "football_data" && !apiKey) {
  console.log("OpenScore provider smoke skipped: FOOTBALL_DATA_API_KEY is not set.");
  process.exit(0);
}

const port = Number.parseInt(process.env.OPEN_SCORE_PROVIDER_SMOKE_PORT ?? "4102", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const shutdownToken = `openscore-provider-smoke-${Date.now()}`;
const childCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const childArgs =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm --filter @openscore/api start"]
    : ["--filter", "@openscore/api", "start"];
const child = spawn(childCommand, childArgs, {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    CI: "true",
    API_BASE_URL: baseUrl,
    WEB_PUBLIC_BASE_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_API_BASE_URL: baseUrl,
    SPORTS_REPOSITORY: "memory",
    CACHE_PROVIDER: "memory",
    SPORTS_PROVIDER: provider,
    FOOTBALL_DATA_API_KEY: apiKey ?? "",
    FOOTBALL_DATA_BASE_URL: process.env.FOOTBALL_DATA_BASE_URL ?? "https://api.football-data.org/v4",
    FOOTBALL_DATA_COMPETITIONS: process.env.FOOTBALL_DATA_COMPETITIONS ?? "PL",
    OPENLIGADB_BASE_URL: process.env.OPENLIGADB_BASE_URL ?? "https://api.openligadb.de",
    OPENLIGADB_LEAGUE: process.env.OPENLIGADB_LEAGUE ?? "bl1",
    OPENLIGADB_SEASON: process.env.OPENLIGADB_SEASON ?? "",
    DATABASE_URL: "postgresql://openscore:openscore@localhost:5432/openscore?schema=public",
    REDIS_URL: "redis://localhost:6379",
    OPEN_SCORE_SMOKE_SHUTDOWN_TOKEN: shutdownToken
  }
});

let output = "";

child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForHealth();
  await assertHealth();
  await assertSports();
  await assertCompetitions();
  await assertTodayFixturesShape();
  await assertFinishedResults();
  await assertStandings();
  await assertSyncRun();
  await assertSyncStatus();
  console.log("OpenScore provider smoke passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("API process output:");
  console.error(output.trim() || "(no output)");
  process.exitCode = 1;
} finally {
  await stopChild();
}

async function waitForHealth() {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API process exited before health check. Exit code: ${child.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the server is ready or the deadline passes.
    }

    await sleep(300);
  }

  throw new Error(`Timed out waiting for API health at ${baseUrl}/health.`);
}

async function assertHealth() {
  const body = await getJson("/health");
  assert(body.data?.ok === true, "Expected /health data.ok to be true.");
  assert(body.data?.provider === provider, `Expected /health provider to be ${provider}.`);
}

async function assertSports() {
  const body = await getJson("/sports");
  assert(Array.isArray(body.data), "Expected /sports data array.");
  assert(body.data.some((sport) => sport.id === "football"), "Expected football sport.");
}

async function assertCompetitions() {
  const body = await getJson("/competitions");
  assert(Array.isArray(body.data), "Expected /competitions data array.");
  assert(body.data.some((competition) => competition.id === competitionId()), `Expected ${competitionId()} competition.`);
}

async function assertTodayFixturesShape() {
  const body = await getJson("/matches/today");
  assert(Array.isArray(body.data?.matches), "Expected /matches/today data.matches array.");

  for (const match of body.data.matches) {
    assert(typeof match.id === "string" && match.id.startsWith(matchIdPrefix()), `Expected ${provider} match id.`);
    assert(typeof match.startsAt === "string", "Expected match startsAt.");
    assert(typeof match.homeTeamName === "string", "Expected home team name.");
    assert(typeof match.awayTeamName === "string", "Expected away team name.");
  }
}

async function assertFinishedResults() {
  const body = await getJson("/matches?status=finished");
  assert(Array.isArray(body.data), "Expected /matches?status=finished data array.");
  assert(body.data.length > 0, `Expected at least one finished ${provider} match.`);
  assert(body.data.some((match) => match.status === "finished"), "Expected finished match status.");
  assert(
    body.data.some((match) => Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore)),
    "Expected integer finished scores."
  );
}

async function assertStandings() {
  const body = await getJson(`/competitions/${competitionId()}/standings`);
  assert(body.data?.competition?.id === competitionId(), `Expected ${competitionId()} competition.`);
  assert(Array.isArray(body.data?.rows), "Expected standings rows array.");
  assert(body.data.rows.length > 0, "Expected real standings rows.");
  assert(Number.isInteger(body.data.rows[0]?.position), "Expected standing position.");
  assert(Number.isInteger(body.data.rows[0]?.points), "Expected standing points.");
}

async function assertSyncRun() {
  const body = await postJson("/sync/run");
  assert(body.data?.status === "succeeded", "Expected /sync/run to succeed.");
  assert(body.data?.provider === provider, `Expected /sync/run provider to be ${provider}.`);
  assert(body.data?.itemsRead > 0, "Expected /sync/run to read provider data.");
}

async function assertSyncStatus() {
  const body = await getJson("/sync/status");
  assert(body.data?.sync?.status === "succeeded", "Expected sync status to be succeeded.");
  assert(body.data?.repository?.standings > 0, "Expected synced standings rows.");
  assert(body.data?.sync?.lock?.provider === "memory", "Expected memory sync lock provider.");
}

function competitionId() {
  return provider === "football_data" ? "premier-league" : "bundesliga";
}

function matchIdPrefix() {
  return provider === "football_data" ? "fd-" : "ol-";
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => undefined);
  assert(response.ok, `Expected GET ${path} to succeed: ${JSON.stringify(body)}`);
  return body;
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const responseBody = await response.json().catch(() => undefined);
  assert(response.ok, `Expected POST ${path} to succeed: ${JSON.stringify(responseBody)}`);
  return responseBody;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function stopChild() {
  if (child.exitCode !== null) {
    return;
  }

  await postJson("/__smoke/shutdown", { token: shutdownToken }).catch(() => undefined);

  if (child.exitCode !== null) {
    return;
  }

  const deadline = Date.now() + 5_000;
  while (child.exitCode === null && Date.now() < deadline) {
    await sleep(100);
  }

  if (child.exitCode === null) {
    child.kill(process.platform === "win32" ? undefined : "SIGTERM");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDotEnv() {
  if (!existsSync(".env")) {
    return;
  }

  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
