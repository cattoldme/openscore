import { spawn } from "node:child_process";

const port = Number.parseInt(process.env.OPEN_SCORE_SMOKE_PORT ?? "4100", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const shutdownToken = `openscore-smoke-${Date.now()}`;
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
    SPORTS_PROVIDER: "mock",
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
  await assertSyncRun();
  await assertSyncStatus();
  await assertMatches();
  await assertStandings();
  await assertTeam();
  await assertAiQuery();
  console.log("OpenScore API smoke passed.");
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
  assert(body.data?.provider === "mock", "Expected /health provider to be mock.");
}

async function assertSyncRun() {
  const body = await postJson("/sync/run");
  assert(body.data?.status === "succeeded", "Expected /sync/run to succeed.");
  assert(body.data?.provider === "mock", "Expected /sync/run provider to be mock.");
  assert(body.data?.itemsRead >= 18, "Expected /sync/run to read mock sports data.");
}

async function assertSyncStatus() {
  const body = await getJson("/sync/status");
  assert(body.data?.sync?.status === "succeeded", "Expected sync status to be succeeded.");
  assert(body.data?.repository?.sports >= 1, "Expected repository sports count.");
  assert(body.data?.repository?.competitions >= 1, "Expected repository competitions count.");
  assert(body.data?.repository?.matches >= 4, "Expected repository matches count.");
  assert(body.data?.repository?.standings >= 6, "Expected repository standings count.");
  assert(body.data?.repository?.teams >= 6, "Expected repository teams count.");
  assert(body.data?.cache?.provider === "memory", "Expected memory cache provider.");
  assert(body.data?.sync?.lock?.provider === "memory", "Expected memory sync lock provider.");
}

async function assertMatches() {
  const body = await getJson("/matches/today");
  assert(Array.isArray(body.data?.matches), "Expected /matches/today data.matches array.");
  assert(body.data.matches.length >= 4, "Expected mock matches.");
  assert(body.data.matches.some((match) => match.status === "live"), "Expected at least one live mock match.");
}

async function assertStandings() {
  const body = await getJson("/competitions/premier-league/standings");
  assert(body.data?.competition?.id === "premier-league", "Expected premier-league competition.");
  assert(Array.isArray(body.data?.rows), "Expected standings rows array.");
  assert(body.data.rows.length >= 6, "Expected mock standings rows.");
  assert(body.data.rows[0]?.teamId === "arsenal", "Expected Arsenal to lead mock standings.");
}

async function assertTeam() {
  const body = await getJson("/teams/arsenal");
  assert(body.data?.team?.id === "arsenal", "Expected Arsenal team detail.");
  assert(Array.isArray(body.data?.form), "Expected Arsenal form array.");
  assert(body.data.form.length >= 5, "Expected Arsenal recent form.");
}

async function assertAiQuery() {
  const body = await postJson("/ai/query", { query: "阿森纳最近状态怎么样？" });
  assert(body.data?.grounded === true, "Expected grounded AI answer.");
  assert(typeof body.data?.answer === "string", "Expected AI answer text.");
  assert(body.data.answer.includes("阿森纳"), "Expected AI answer to mention Arsenal.");
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json();
  assert(response.ok, `Expected GET ${path} to succeed: ${JSON.stringify(body)}`);
  return body;
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const responseBody = await response.json();
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
