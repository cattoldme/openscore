# OpenScore 部署指南

更新时间：2026-06-29

## 1. 当前部署目标

OpenScore MVP 先支持 Docker Compose 自建部署：

- `web`：Next.js PWA，默认端口 `3000`
- `api`：Hono API，默认端口 `4000`
- `postgres`：PostgreSQL 16，默认端口 `5432`
- `redis`：Redis 7，默认端口 `6379`

当前 API 默认使用内存 repository 和内存 cache。PostgreSQL repository 已实现，可通过 `SPORTS_REPOSITORY=postgres` 开启；Redis 已进入部署拓扑，用于后续分布式缓存和同步锁接入。

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
SPORTS_PROVIDER=mock
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

使用 PostgreSQL repository 时，先推送 schema，然后切换 repository：

```powershell
pnpm db:push
```

```env
SPORTS_REPOSITORY=postgres
DATABASE_URL=postgresql://openscore:openscore@localhost:5432/openscore?schema=public
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
- PostgreSQL schema 和 repository 代码已验证到类型/构建层，但当前机器没有 PostgreSQL/Docker，尚未执行 `pnpm db:push` 和真实数据库 smoke test。
- 默认 `SPORTS_REPOSITORY=memory` 时，服务重启后内存 repository 数据会丢失。
- Redis 已在拓扑中，但 API cache 仍是内存 TTL cache。
- football-data.org 真实数据需要 `FOOTBALL_DATA_API_KEY`。
- AI 查询当前是确定性 grounded MVP，还没有接真实 LLM provider。

## 8. 后续部署演进

下一步：

1. 添加 migration/seed 执行流程
2. 把 Redis 接入 cache 和 sync lock
3. 拆分生产 Dockerfile，减小镜像体积
4. 添加 CI 构建和镜像发布
