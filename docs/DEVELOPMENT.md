# OpenScore 开发说明

更新时间：2026-06-28

## 1. 当前工程状态

当前仓库已经完成第一版工程骨架：

- pnpm workspace
- Next.js Web App：`apps/web`
- Hono API：`apps/api`
- 共享领域模型：`packages/domain`
- 环境变量校验：`packages/config`
- mock 数据源：`packages/providers`
- Prisma schema：`packages/db/prisma/schema.prisma`
- Docker Compose：`docker-compose.yml`
- 今日比赛、积分榜、球队状态和本地收藏的最小产品链路

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

Prisma schema 验证：

```powershell
pnpm db:validate
```

生成 Prisma Client：

```powershell
pnpm db:generate
```

当前已验证：

- `pnpm install`
- `pnpm db:validate`
- `pnpm db:generate`
- `pnpm typecheck`
- `pnpm build`

## 5. API 快速检查

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/matches/today
Invoke-RestMethod http://localhost:4000/competitions/premier-league/standings
```

## 6. 中文路径注意事项

当前工作区路径包含中文：`体育赛事咨询软件`。

Next.js 16 默认使用 Turbopack。实测如果 Turbopack 错误推断 workspace root 到 `C:\Users\catto`，会在中文路径上触发内部 panic：

```text
start byte index ... is not a char boundary
```

已在 `apps/web/next.config.ts` 中显式设置 `turbopack.root` 为仓库根目录，避免该问题。

## 7. 当前限制

- 目前使用 mock provider，还没有接真实体育数据 API。
- Docker 未准备好，PostgreSQL/Redis 还没有本地容器环境。
- AI 查询入口在 API 中已有占位实现，但尚未接真实模型。
- Web 首页已有本地收藏比赛功能，暂未实现账户同步。
- Prisma schema 已验证，但未执行真实数据库 migration，因为当前机器 `docker` 命令不可用。

## 8. 下一步建议

1. 安装 Docker Desktop 并启动 PostgreSQL/Redis
2. 执行第一版 migration
3. 把 mock 数据落到 repository 接口后面
4. 接入第一个真实 provider
5. 加 Playwright smoke test
