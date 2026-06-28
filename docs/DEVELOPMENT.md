# OpenScore 开发说明

更新时间：2026-06-29

## 1. 当前工程状态

当前仓库已经完成第一版工程骨架：

- pnpm workspace
- Next.js Web App：`apps/web`
- Hono API：`apps/api`
- 共享领域模型：`packages/domain`
- 环境变量校验：`packages/config`
- mock 数据源和 football-data provider 适配器：`packages/providers`
- Prisma schema 和 repository 抽象：`packages/db`
- 内存 cache 和 Redis cache adapter
- Dockerfile 和 Docker Compose：`Dockerfile`、`docker-compose.yml`，Compose 会先执行 `db-init`
- GitHub Actions CI：`.github/workflows/ci.yml`
- 今日比赛、积分榜、球队详情、球队状态、本地收藏、repository 读写、缓存、手动同步状态和自然语言查询的最小产品链路

## 2. 安装依赖

```powershell
pnpm install
```

如果在 Codex/CI 这类非交互环境中运行，建议显式设置 `CI=true`：

```powershell
$env:CI='true'; pnpm install
```

pnpm 11 会拦截依赖构建脚本。如果出现 `ERR_PNPM_IGNORED_BUILDS`，当前锁定依赖需要批准：

```powershell
pnpm approve-builds --all
pnpm install
```

本项目当前批准的构建脚本来自：

- `esbuild`
- `sharp`
- `@prisma/engines`
- `prisma`

## 3. 本地启动

启动 API：

```powershell
pnpm dev:api
```

启动 Web：

```powershell
pnpm dev:web
```

或并行启动：

```powershell
pnpm dev
```

默认地址：

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## 4. 验证命令

类型检查：

```powershell
pnpm typecheck
```

生产构建：

```powershell
pnpm build
```

API 冒烟测试：

```powershell
pnpm smoke:api
```

`pnpm smoke:api` 会启动生产构建后的 API 到独立端口 `4100`，使用 `mock` provider、内存 repository 和内存 cache，依次检查 `/health`、`/sync/run`、`/sync/status`、今日比赛、积分榜、球队详情和 AI 查询。运行前需要先执行 `pnpm build`。

Web 冒烟测试：

```powershell
pnpm smoke:web
```

`pnpm smoke:web` 会启动生产构建后的 API 和 Web，API 端口为 `4101`，Web 端口为 `3100`，使用 `mock` provider、内存 repository 和内存 cache，检查首页与 `/teams/arsenal` 是否能渲染关键中文内容。运行前需要先执行 `pnpm build`。

Prisma schema 验证：

```powershell
pnpm db:validate
```

生成 Prisma Client：

```powershell
pnpm db:generate
```

把 schema 推送到开发数据库：

```powershell
pnpm db:push
```

执行已提交的 migration：

```powershell
pnpm db:migrate
```

写入 mock seed 数据：

```powershell
pnpm db:seed
```

无数据库环境下校验 seed payload：

```powershell
pnpm db:seed:dry-run
```

当前已验证：

- `pnpm install`
- `pnpm db:validate`
- `pnpm db:generate`
- `pnpm db:seed:dry-run`
- `pnpm typecheck`
- `pnpm build`
- `pnpm smoke:api`
- `pnpm smoke:web`

GitHub Actions 会在 push 和 pull request 上运行：

- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm db:seed:dry-run`
- `pnpm typecheck`
- `pnpm build`
- `pnpm smoke:api`
- `pnpm smoke:web`

## 5. API 快速检查

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/matches/today
Invoke-RestMethod http://localhost:4000/competitions/premier-league/standings
Invoke-RestMethod http://localhost:4000/teams/arsenal
Invoke-RestMethod http://localhost:4000/sync/status
Invoke-RestMethod -Method Post http://localhost:4000/sync/run
Invoke-RestMethod -Method Post http://localhost:4000/ai/query -ContentType 'application/json' -Body '{"query":"阿森纳最近状态怎么样？"}'
```

`POST /sync/run` 会从当前 provider 拉取 sports、competitions、today fixtures 和 `premier-league` standings，并写入当前 repository。`GET /sync/status` 会返回 sync、repository 和 cache 三块状态，方便确认 API 当前读的是本地数据层还是 provider fallback。

`POST /ai/query` 当前是确定性 grounded MVP：API 会先检索今日比赛、进行中比赛和积分榜，再按简单意图路由生成中文回答，并返回相关比赛卡片、数据源和更新时间。

Web 快速检查：

```powershell
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
Invoke-WebRequest http://localhost:3000/teams/arsenal -UseBasicParsing
```

## 6. 中文路径注意事项

当前工作区路径包含中文：`体育赛事咨询软件`。

Next.js 16 默认使用 Turbopack。实测如果 Turbopack 错误推断 workspace root 到 `C:\Users\catto`，会在中文路径上触发内部 panic：

```text
start byte index ... is not a char boundary
```

已在 `apps/web/next.config.ts` 中显式设置 `turbopack.root` 为仓库根目录，避免该问题。

## 7. 数据源切换

默认使用 mock provider：

```powershell
$env:SPORTS_PROVIDER='mock'
```

默认使用内存 cache：

```powershell
$env:CACHE_PROVIDER='memory'
```

切换到 Redis cache：

```powershell
$env:CACHE_PROVIDER='redis'
$env:REDIS_URL='redis://localhost:6379'
```

切换到 football-data provider：

```powershell
$env:SPORTS_PROVIDER='football_data'
$env:FOOTBALL_DATA_API_KEY='<your-api-key>'
$env:FOOTBALL_DATA_COMPETITIONS='PL'
```

football-data provider 当前已标准化：

- 比赛列表：`GET /matches/today`
- 进行中比赛：`GET /live/matches/events`
- 积分榜：`GET /competitions/premier-league/standings`
- 球队详情：`GET /teams/fd-<football-data-team-id>`

## 8. 当前限制

- 默认仍使用 mock provider；football-data 适配器已实现，但本机没有真实 API key，尚未做线上数据 smoke test。
- Docker 未准备好，当前机器还不能实测 `docker compose up --build`。
- 当前 repository 默认是内存实现，服务重启后同步数据会丢失；PostgreSQL repository 已实现，但当前机器没有 PostgreSQL/Docker，尚未做真实数据库 smoke test。
- AI 查询已有前端入口和 grounded API 回答，但尚未接真实 LLM provider。
- Web 首页已有本地收藏比赛功能，暂未实现账户同步。
- Prisma schema、首个 migration、seed dry-run 和 Compose db-init 配置已验证；真实数据库 migration/seed 因当前机器 `docker` 命令不可用尚未实测。
- CI 已覆盖 schema/client/typecheck/build/API smoke/Web smoke，但还没有真实 PostgreSQL、Redis runtime、provider key 或浏览器级端到端测试。

## 9. 下一步建议

1. 安装 Docker Desktop 并启动 PostgreSQL/Redis
2. 执行 `docker compose up --build`
3. 用真实 `FOOTBALL_DATA_API_KEY` 做 provider smoke test
4. 将默认部署接入真实 `SPORTS_PROVIDER`
5. 加浏览器级 Playwright smoke test

部署说明见 [Deployment](DEPLOYMENT.md)。
