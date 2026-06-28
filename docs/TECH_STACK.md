# OpenScore 技术选型

更新时间：2026-06-28

## 1. 选型结论

OpenScore 第一阶段采用 **TypeScript 全栈 monorepo + 模块化单体架构**。

核心技术栈：

| 层级 | 选型 | 结论 |
|---|---|---|
| Monorepo | pnpm workspace | 包管理快，workspace 简洁，适合前后端共享类型 |
| Web 前端 | Next.js App Router + React + TypeScript | 移动端页面、SSR/SEO、PWA、后续公开 Demo 都合适 |
| 样式 | Tailwind CSS | 快速构建干净、统一、响应式 UI |
| API 服务 | Hono + TypeScript | 轻量、快、路由清晰，支持类型化客户端和多运行时 |
| 数据库 | PostgreSQL | 结构化赛事数据、积分榜、同步任务都适合关系模型 |
| ORM/迁移 | Prisma | 类型安全、迁移清晰、开发体验好 |
| 缓存 | Redis | 热门比赛、今日赛程、同步锁、限流都需要 |
| 校验 | Zod | API 入参、Provider 数据标准化、环境变量校验 |
| 实时 | Server-Sent Events | 比分是单向推送，SSE 比 WebSocket 更简单 |
| 后台任务 | API 内置 scheduler 起步，后续 BullMQ | MVP 先轻量，数据同步复杂后再引入队列 |
| AI 查询 | OpenAI-compatible adapter | 不绑定单一模型供应商，回答必须基于结构化数据 |
| 测试 | Vitest + Playwright | 单元/集成/端到端覆盖核心数据链路和 UI |
| 部署 | Docker Compose 起步 | 便于自建；后续可拆 Web/API/DB/Redis |

## 2. 为什么不是一开始微服务

OpenScore 现在最重要的是验证产品体验，不是提前做复杂平台。

第一阶段不拆微服务，原因：

- 数据模型还会频繁调整
- Provider adapter 需要快速试错
- 前后端类型共享很重要
- 运维复杂度应该尽量低
- MVP 用户量不会先卡在服务拆分上

但模块边界会按未来拆分来设计：

- `web` 只关心展示和交互
- `api` 只暴露产品 API
- `domain` 放核心类型和业务规则
- `providers` 放外部数据源适配
- `db` 放 Prisma schema、迁移、repository
- `ai` 放自然语言查询和回答生成

## 3. 前端选型

### 3.1 选择 Next.js App Router

理由：

- 适合公开 Web 产品和 SEO
- 支持布局、嵌套路由、加载状态和错误边界
- 可以做 PWA，先覆盖移动端体验
- 与 React 生态兼容度高
- 后续做服务端渲染的比赛页、球队页、联赛页更自然

### 3.2 前端职责

前端只负责：

- 页面布局
- 用户交互
- 收藏状态
- 数据展示
- 调用 API
- SSE 订阅

前端不直接调用第三方体育数据源。

### 3.3 UI 原则

- Mobile first
- 无广告位
- 无博彩导向模块
- 比赛列表优先可扫读
- 关键信息一屏内完成判断
- 深色/浅色主题后续支持

## 4. API 选型

### 4.1 选择 Hono

理由：

- API 路由非常轻
- TypeScript 体验好
- 中间件模型清晰
- 可导出 route type，方便前端类型化调用
- 运行时可迁移，未来可部署到 Node、Bun 或边缘环境

### 4.2 API 职责

API 负责：

- 聚合查询
- 鉴权预留
- 收藏接口
- 比赛/球队/联赛查询
- SSE 实时更新
- AI 查询入口
- Provider sync 触发和状态查看

API 不把外部 provider 的原始结构直接暴露给前端。

## 5. 数据库选型

### 5.1 选择 PostgreSQL

理由：

- 赛事、球队、联赛、赛季、积分榜天然适合关系模型
- 后续可以使用 JSONB 保存 provider 原始 payload
- 支持索引、事务和约束
- 自建部署成熟

### 5.2 选择 Prisma

理由：

- schema 可读性好
- migration 适合团队协作
- TypeScript 类型安全
- 查询层足够覆盖 MVP

数据库访问必须通过 repository/service 层，避免页面或 route handler 直接散落 Prisma 查询。

当前采用 Prisma 7：

- schema: `packages/db/prisma/schema.prisma`
- config: `packages/db/prisma.config.ts`
- validate: `pnpm db:validate`
- generate: `pnpm db:generate`

Prisma 7 不再把连接串写在 schema 的 `datasource.url` 中，连接串由 `prisma.config.ts` 读取 `DATABASE_URL`。

## 6. 缓存选型

Redis 用于：

- 今日比赛缓存
- 进行中比赛短 TTL 缓存
- Provider API 限流计数
- 同步任务锁
- SSE fanout 的轻量状态

缓存不是事实来源，PostgreSQL 才是主数据源。

## 7. 实时方案

MVP 选择 SSE。

原因：

- 比分更新是服务端到客户端的单向消息
- 浏览器原生支持 EventSource
- 比 WebSocket 简单
- 更容易做断线重连

升级 WebSocket 的条件：

- 需要用户在线协作
- 需要双向实时交互
- 需要复杂房间/频道管理

## 8. AI 查询方案

AI 查询不允许凭空回答。

固定流程：

1. 用户输入自然语言
2. API 做意图识别
3. 根据意图查询结构化数据
4. 将检索结果交给模型总结
5. 返回答案、数据卡片、更新时间和来源

模型只做解释，不做事实来源。

## 9. 部署策略

### 9.1 MVP 自建部署

使用 Docker Compose：

- web
- api
- postgres
- redis

### 9.2 Demo 部署

可选：

- Web: Vercel
- API: Fly.io / Render / Railway
- DB: Supabase / Neon / Railway Postgres
- Redis: Upstash / Railway Redis

正式选择之前，优先保证 Docker Compose 本地可跑。

## 10. 暂不采用

| 技术 | 暂不采用原因 |
|---|---|
| React Native / Expo | 先用 PWA 验证体验，避免移动端双端成本 |
| WebSocket | MVP SSE 足够 |
| Kafka | 数据量没到这个级别 |
| Elasticsearch | 先用 PostgreSQL 查询，后续再加搜索 |
| 微服务 | 过早复杂化 |
| GraphQL | 当前 REST/SSE 更直接，Hono 类型化客户端足够 |
| 赔率模块 | 合规风险高，MVP 不做 |

## 11. 版本策略

不在文档里硬编码具体大版本，实际 scaffold 时使用当时稳定版，并在 `package.json`、lockfile 和 `docs/DECISIONS.md` 中记录。

原则：

- 不追 canary
- 不使用未稳定 API
- 前端、API、数据库迁移都必须可重复构建
- 依赖升级单独提交，避免混在功能开发里
