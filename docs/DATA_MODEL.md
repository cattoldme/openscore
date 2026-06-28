# OpenScore 数据模型草案

更新时间：2026-06-28

## 1. 建模原则

- 内部主键与外部 provider ID 分离
- 所有比赛时间存 UTC
- 原始 provider payload 可用 JSONB 保存
- 比赛、球队、联赛必须支持多个 provider mapping
- MVP 只建足球需要的最小模型，但命名保留多体育项目扩展空间

当前 Prisma schema 位于：

```text
packages/db/prisma/schema.prisma
```

Prisma 7 已将连接串配置迁移到：

```text
packages/db/prisma.config.ts
```

验证命令：

```powershell
pnpm db:validate
```

## 2. 核心实体

### Sport

体育项目。

字段：

- id
- code
- name

示例：

- football
- basketball

### Competition

赛事或联赛。

字段：

- id
- sportId
- name
- shortName
- countryCode
- type
- logoUrl

### Season

赛季。

字段：

- id
- competitionId
- name
- startsAt
- endsAt
- current

### Team

球队。

字段：

- id
- sportId
- name
- shortName
- countryCode
- logoUrl
- venueId

### Match

比赛。

字段：

- id
- sportId
- competitionId
- seasonId
- homeTeamId
- awayTeamId
- startsAt
- status
- minute
- homeScore
- awayScore
- homeHalfScore
- awayHalfScore
- venueId
- updatedAt

### MatchEvent

比赛事件。

字段：

- id
- matchId
- teamId
- playerName
- minute
- type
- payload

事件类型：

- goal
- yellow_card
- red_card
- substitution
- penalty
- own_goal

### Standing

积分榜行。

字段：

- id
- competitionId
- seasonId
- teamId
- position
- played
- won
- drawn
- lost
- goalsFor
- goalsAgainst
- goalDifference
- points
- form
- updatedAt

### ProviderSource

外部数据源。

字段：

- id
- code
- name
- baseUrl
- enabled

### ProviderEntityMap

内部实体和外部 provider ID 的映射。

字段：

- id
- providerSourceId
- entityType
- entityId
- providerEntityId
- rawPayload
- updatedAt

### SyncJobRun

数据同步任务记录。

字段：

- id
- providerSourceId
- jobType
- status
- startedAt
- finishedAt
- itemsRead
- itemsWritten
- errorCode
- errorMessage

## 3. 枚举

### MatchStatus

```text
scheduled
live
paused
finished
postponed
cancelled
unknown
```

### CompetitionType

```text
league
cup
friendly
international
unknown
```

### ProviderCode

```text
football_data
thesportsdb
openligadb
openfootball
mock
```

## 4. 查询优先级

MVP 必须优先优化：

- 今日比赛
- 联赛积分榜
- 球队近期 5 场
- 比赛详情
- 进行中比赛

建议索引：

- `Match(startsAt)`
- `Match(status, startsAt)`
- `Match(competitionId, startsAt)`
- `Match(homeTeamId, startsAt)`
- `Match(awayTeamId, startsAt)`
- `Standing(competitionId, seasonId, position)`
- `ProviderEntityMap(providerSourceId, entityType, providerEntityId)`

## 5. 数据一致性

规则：

- 同一 provider 的同一 providerEntityId 不得映射到多个内部实体
- 比赛比分以最新 provider 更新时间为准
- 若 provider 返回冲突数据，保留 rawPayload 并记录 sync warning
- 删除外部数据不立刻删除内部实体，先标记不可见或过期
