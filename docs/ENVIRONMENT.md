# OpenScore 环境准备与复检

更新时间：2026-06-29

## 1. 当前本机复检结果

已在 `C:\Users\catto\Documents\体育赛事咨询软件` 实测。

| 项目 | 状态 | 实测结果 |
|---|---|---|
| Git | 可用 | `git version 2.52.0.windows.1` |
| GitHub CLI | 可用 | `gh version 2.89.0` |
| GitHub 登录 | 可用 | 已登录 `cattoldme`，具备 `repo` 权限 |
| GitHub 仓库 | 可用 | `cattoldme/openscore`，public，默认分支 `main` |
| Node.js | 可用 | `v24.15.0` |
| npm | 可用 | `11.15.0` |
| pnpm | 可用 | `11.7.0` |
| Corepack | 可用 | `0.34.6` |
| Docker | 未安装或未进 PATH | `docker` 命令不可用 |
| Docker Compose | 未安装或未进 PATH | `docker compose` 命令不可用 |
| psql | 未安装或未进 PATH | `psql` 命令不可用 |
| Redis server | 未安装或未进 PATH | `redis-server` 命令不可用 |

结论：

- 前端、API、TypeScript monorepo 的基础开发环境已经可用。
- GitHub 推送环境已经可用。
- 本地数据库/缓存环境还没准备好，主要缺 Docker 或本机 PostgreSQL/Redis。

## 2. 开工前必须准备

### 2.1 必须项

- Node.js 已可用
- pnpm 已可用
- Git 已可用
- GitHub CLI 已登录
- `.env.example` 已提供

### 2.2 数据层准备方式

推荐方案：安装 Docker Desktop，然后用 Docker Compose 启动 PostgreSQL 和 Redis。

原因：

- 不污染 Windows 本机服务
- 数据库/缓存版本可固定
- 后续开源用户更容易复现
- CI 和本地环境更一致

备选方案：

- PostgreSQL 使用 Neon / Supabase / Railway
- Redis 使用 Upstash / Railway Redis
- 本地只跑 Web 和 API

如果采用云数据库/云 Redis，需要把 `.env` 中的 `DATABASE_URL` 和 `REDIS_URL` 替换为云端连接串。

## 3. 推荐本地开发端口

| 服务 | 端口 | 说明 |
|---|---:|---|
| Web | 3000 | Next.js PWA |
| API | 4000 | Hono API |
| PostgreSQL | 5432 | 本地数据库 |
| Redis | 6379 | 本地缓存 |
| Prisma Studio | 5555 | 数据库查看工具 |

## 4. 环境变量

本地开发流程：

```powershell
Copy-Item .env.example .env
```

`.env` 不提交 Git，真实密钥只放本机或部署平台。

关键变量：

| 变量 | 必需 | 说明 |
|---|---|---|
| `NODE_ENV` | 是 | 本地为 `development` |
| `WEB_PUBLIC_BASE_URL` | 是 | Web 访问地址 |
| `API_BASE_URL` | 是 | API 访问地址 |
| `NEXT_PUBLIC_API_BASE_URL` | 是 | 浏览器端调用 API 的公开地址 |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `REDIS_URL` | 是 | Redis 连接串 |
| `SPORTS_PROVIDER` | 是 | MVP 可先用 `mock` |
| `FOOTBALL_DATA_API_KEY` | 否 | 接入 football-data.org 时填写 |
| `FOOTBALL_DATA_BASE_URL` | 是 | 默认 `https://api.football-data.org/v4` |
| `FOOTBALL_DATA_COMPETITIONS` | 是 | 默认 `PL`，多个赛事用英文逗号分隔 |
| `THESPORTSDB_API_KEY` | 否 | 接入 TheSportsDB 时填写 |
| `AI_PROVIDER` | 是 | MVP 可先用 `disabled` |
| `OPENAI_API_KEY` | 否 | 启用 AI 查询时填写 |

## 5. 第一阶段建议

在真正接入外部数据源前，先按以下顺序推进：

1. 搭 `pnpm workspace`
2. 建 `apps/web` 和 `apps/api`
3. 建 `packages/domain`
4. 使用 mock provider 跑通今日比赛、积分榜、球队详情
5. 加 `.env` 校验
6. 再上 PostgreSQL/Prisma
7. 最后接真实体育数据 API

这样可以先验证产品体验，不会一开始被第三方 API 限额、字段差异和密钥申请卡住。

## 6. 当前缺口

必须补齐：

- Docker Desktop 或等价的 PostgreSQL/Redis 环境
- `.env` 本地文件

可以稍后补：

- 外部体育数据 API key
- OpenAI-compatible API key
- CI
- 部署平台配置

已补齐：

- pnpm workspace scaffold
- `.env.example`
- 本机 `.env` mock 开发配置
- Web/API 基础工程
- mock provider
- football-data provider 适配器
- API 内存缓存和手动同步状态接口
- 第一版 `Dockerfile`
- Web/API/PostgreSQL/Redis `docker-compose.yml`
- 简单部署指南：`docs/DEPLOYMENT.md`
- Prisma schema 与 validate/generate 脚本

## 7. 非交互环境提示

在 Codex 或 CI 这类非交互终端里，如果 pnpm 提示：

```text
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
```

使用：

```powershell
$env:CI='true'; pnpm install
$env:CI='true'; pnpm typecheck
$env:CI='true'; pnpm build
```

普通本地 PowerShell 终端通常不需要这样做。
