import { spawn } from "node:child_process";
import { join } from "node:path";

const rootDir = process.cwd();
const apiPort = Number.parseInt(process.env.OPEN_SCORE_WEB_SMOKE_API_PORT ?? "4101", 10);
const webPort = Number.parseInt(process.env.OPEN_SCORE_WEB_SMOKE_WEB_PORT ?? "3100", 10);
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;
const shutdownToken = `openscore-web-smoke-${Date.now()}`;

const api = spawn(process.execPath, [join(rootDir, "apps/api/dist/index.js")], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    CI: "true",
    API_BASE_URL: apiBaseUrl,
    WEB_PUBLIC_BASE_URL: webBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    SPORTS_REPOSITORY: "memory",
    SPORTS_PROVIDER: "mock",
    DATABASE_URL: "postgresql://openscore:openscore@localhost:5432/openscore?schema=public",
    REDIS_URL: "redis://localhost:6379",
    OPEN_SCORE_SMOKE_SHUTDOWN_TOKEN: shutdownToken
  }
});

const web = spawn(
  process.execPath,
  [join(rootDir, "apps/web/node_modules/next/dist/bin/next"), "start", "--port", String(webPort), "--hostname", "127.0.0.1"],
  {
    cwd: join(rootDir, "apps/web"),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      CI: "true",
      API_BASE_URL: apiBaseUrl,
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
      NEXT_TELEMETRY_DISABLED: "1"
    }
  }
);

let apiOutput = "";
let webOutput = "";

api.stdout.on("data", (chunk) => {
  apiOutput += chunk.toString();
});
api.stderr.on("data", (chunk) => {
  apiOutput += chunk.toString();
});
web.stdout.on("data", (chunk) => {
  webOutput += chunk.toString();
});
web.stderr.on("data", (chunk) => {
  webOutput += chunk.toString();
});

try {
  await waitForUrl(`${apiBaseUrl}/health`, api, "API");
  await postJson(`${apiBaseUrl}/sync/run`);
  await waitForUrl(webBaseUrl, web, "Web");
  await assertHomePage();
  await assertTeamPage();
  console.log("OpenScore Web smoke passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("API process output:");
  console.error(apiOutput.trim() || "(no output)");
  console.error("Web process output:");
  console.error(webOutput.trim() || "(no output)");
  process.exitCode = 1;
} finally {
  await stopApi();
  await stopProcess(web);
}

async function assertHomePage() {
  const html = await getText(webBaseUrl);

  assertIncludes(html, "干净、开源、无广告的比分工具", "Expected homepage headline.");
  assertIncludes(html, "今日比赛", "Expected today's matches section.");
  assertIncludes(html, "积分榜", "Expected standings section.");
  assertIncludes(html, "阿森纳", "Expected Arsenal to render on homepage.");
}

async function assertTeamPage() {
  const html = await getText(`${webBaseUrl}/teams/arsenal`);

  assertIncludes(html, "阿森纳", "Expected Arsenal team page.");
  assertIncludes(html, "近期状态", "Expected team form section.");
  assertIncludes(html, "相关比赛", "Expected related matches section.");
  assertIncludes(html, "返回今日比赛", "Expected navigation back to homepage.");
}

async function waitForUrl(url, child, label) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${label} process exited before smoke check. Exit code: ${child.exitCode}`);
    }

    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the server is ready or the deadline passes.
    }

    await sleep(300);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}.`);
}

async function getText(url) {
  const response = await fetch(url);
  const body = await response.text();
  assert(response.ok, `Expected GET ${url} to succeed with status 2xx, got ${response.status}.`);
  return body;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const responseBody = await response.json();
  assert(response.ok, `Expected POST ${url} to succeed: ${JSON.stringify(responseBody)}`);
  return responseBody;
}

async function stopApi() {
  if (api.exitCode !== null) {
    return;
  }

  await postJson(`${apiBaseUrl}/__smoke/shutdown`, { token: shutdownToken }).catch(() => undefined);
  await waitForExit(api, 5_000);

  if (api.exitCode === null) {
    api.kill(process.platform === "win32" ? undefined : "SIGTERM");
  }
}

async function stopProcess(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill(process.platform === "win32" ? undefined : "SIGTERM");
  await waitForExit(child, 5_000);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function waitForExit(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (child.exitCode === null && Date.now() < deadline) {
    await sleep(100);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, expected, message) {
  assert(text.includes(expected), message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
