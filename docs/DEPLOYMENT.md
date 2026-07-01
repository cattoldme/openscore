# OpenScore 部署指南

更新时间：2026-06-29

## 1. 当前部署目标

OpenScore MVP 先支持 Docker Compose 自建部署：

- `web`：Next.js PWA，默认端口 `3000`
- `api`：Hono API，默认端口 `4000`
- `postgres`：PostgreSQL 16，默认端口 `5432`
- `redis`：Redis 7，默认端口 `6379`

本地开发默认使用内存 repository、内存 cache 和内存 sync lock。Docker Compose 默认使用 PostgreSQL repository、Redis cache 和 Redis sync lock，并通过 `db-init` 服务在 API 启动前执行 `pnpm db:migrate && pnpm db:seed`。

## 2. 前置要求

必须具备：

- Docker Desktop 或兼容 Docker Engine
- Docker Compose v2
- Git

推荐资源：

- CPU：2 核以上
- 内存：2 GB 以上
- 磁盘：5 GB 以上

## 3. 准备环境变量

复制模板：

```powershell
Copy-Item .env.example .env
```

本地 mock 模式可以直接使用默认值：

```env
SPORTS_REPOSITORY=memory
CACHE_PROVIDER=memory
SPORTS_PROVIDER=mock
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Docker Compose 会使用容器内 PostgreSQL 和 Redis，不读取本机开发用的 `DATABASE_URL=localhost` 或 `REDIS_URL=localhost`。如需覆盖 Compose 数据库、Redis、repository 或 cache，可设置：

```env
COMPOSE_DATABASE_URL=postgresql://openscore:openscore@postgres:5432/openscore?schema=public
COMPOSE_REDIS_URL=redis://redis:6379
COMPOSE_SPORTS_REPOSITORY=postgres
COMPOSE_CACHE_PROVIDER=redis
```

如果不使用 Docker Compose，而是本机或云端 PostgreSQL，则先执行 migration 和 seed，然后切换 repository：

```powershell
pnpm db:migrate
pnpm db:seed
```

```env
SPORTS_REPOSITORY=postgres
CACHE_PROVIDER=redis
DATABASE_URL=postgresql://openscore:openscore@localhost:5432/openscore?schema=public
REDIS_URL=redis://localhost:6379
```

默认可以使用无密钥 OpenLigaDB：

```env
SPORTS_PROVIDER=openligadb
OPENLIGADB_BASE_URL=https://api.openligadb.de
OPENLIGADB_LEAGUE=bl1
OPENLIGADB_SEASON=
```

接入 football-data.org 时填写：

```env
SPORTS_PROVIDER=football_data
FOOTBALL_DATA_API_KEY=your-api-key
FOOTBALL_DATA_COMPETITIONS=PL
```

浏览器端访问 API 的地址由 `NEXT_PUBLIC_API_BASE_URL` 控制。自建在本机时保持 `http://localhost:4000`；如果部署到服务器域名，需要改成公开 API 地址。

## 4. 启动服务

```powershell
docker compose up --build
```

后台启动：

```powershell
docker compose up --build -d
```

访问地址：

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`

启动顺序：

1. `postgres` 健康检查通过
2. `db-init` 执行 migration 和 seed
3. `api` 使用 PostgreSQL repository、Redis cache 和 Redis sync lock 启动
4. `web` 等 API 健康后启动

## 5. 验证部署

API：

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/matches/today
Invoke-RestMethod http://localhost:4000/competitions/premier-league/standings
Invoke-RestMethod -Method Post http://localhost:4000/ai/query -ContentType 'application/json' -Body '{"query":"现在有进行中的比赛吗？"}'
```

Web：

```powershell
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

同步状态：

```powershell
Invoke-RestMethod http://localhost:4000/sync/status
Invoke-RestMethod -Method Post http://localhost:4000/sync/run
```

## 6. 常用运维命令

查看服务：

```powershell
docker compose ps
```

查看日志：

```powershell
docker compose logs -f api
docker compose logs -f web
```

停止：

```powershell
docker compose down
```

停止并删除数据库/Redis 数据卷：

```powershell
docker compose down -v
```

## 7. 当前限制

- 本机复检时 `docker` 命令不可用，因此本文的 Docker Compose 运行还未在当前机器实测。
- PostgreSQL schema、migration、repository、seed dry-run 和 Compose 配置已验证到类型/构建层，但当前机器没有 PostgreSQL/Docker，尚未执行真实 Docker Compose smoke test。
- 本地开发默认 `SPORTS_REPOSITORY=memory` 时，服务重启后内存 repository 数据会丢失；Docker Compose 默认使用 `COMPOSE_SPORTS_REPOSITORY=postgres`。
- Redis cache adapter 和 Redis sync lock 已实现；真实 Redis runtime smoke 仍需 Docker 或 Redis 环境。
- OpenLigaDB 真实数据不需要 API key；football-data.org 真实数据需要 `FOOTBALL_DATA_API_KEY`。
- AI 查询当前是确定性 grounded MVP，还没有接真实 LLM provider。

## 8. 后续部署演进

下一步：

1. 拆分生产 Dockerfile，减小镜像体积
2. 添加镜像发布流程
3. 补真实 PostgreSQL/Redis runtime smoke
