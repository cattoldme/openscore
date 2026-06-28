import type { ProviderCode } from "@openscore/domain";
import { createInMemorySportsRepository, type SportsRepository } from "@openscore/db";
import { createSportsDataProvider, type SportsDataProviderOptions } from "@openscore/providers";
import { type CacheStore, TtlCache } from "./cache";

const TTL = {
  sports: 60 * 60 * 1000,
  competitions: 60 * 60 * 1000,
  standings: 5 * 60 * 1000,
  matches: 60 * 1000,
  live: 30 * 1000,
  team: 60 * 60 * 1000,
  teamForm: 5 * 60 * 1000,
  ai: 30 * 1000
};

export type CreateSportsServiceOptions = SportsDataProviderOptions & {
  repository?: SportsRepository;
  cache?: CacheStore;
};

export function createSportsService(providerCode: ProviderCode, options: CreateSportsServiceOptions = {}) {
  const provider = createSportsDataProvider(providerCode, options);
  const repository = options.repository ?? createInMemorySportsRepository();
  const cache = options.cache ?? new TtlCache();

  return {
    provider,
    repository,
    cache,
    async listSports() {
      return cache.getOrSet("sports", TTL.sports, async () => {
        const stored = await repository.listSports();

        if (stored.length > 0) {
          return stored;
        }

        const items = await provider.fetchSports();
        await repository.upsertSports(items);
        return items;
      });
    },
    async listCompetitions() {
      return cache.getOrSet("competitions", TTL.competitions, async () => {
        const stored = await repository.listCompetitions();

        if (stored.length > 0) {
          return stored;
        }

        const items = await provider.fetchCompetitions();
        await repository.upsertCompetitions(items);
        return items;
      });
    },
    async getCompetition(id: string) {
      const stored = await repository.findCompetition(id);

      if (stored) {
        return stored;
      }

      const competitions = await this.listCompetitions();
      return competitions.find((competition) => competition.id === id) ?? null;
    },
    async getStandings(competitionId: string) {
      return cache.getOrSet(`standings:${competitionId}`, TTL.standings, async () => {
        const stored = await repository.listStandings(competitionId);

        if (stored.length > 0) {
          return stored;
        }

        const rows = await provider.fetchStandings({ competitionId });
        await repository.upsertStandings(competitionId, rows);
        return rows;
      });
    },
    async listMatches(input: { date?: "today"; status?: string } = {}) {
      return cache.getOrSet(`matches:${JSON.stringify(input)}`, TTL.matches, async () => {
        const stored = await repository.listMatches(input);

        if (stored.length > 0) {
          return stored;
        }

        const items = await provider.fetchFixtures(input);
        await repository.upsertMatches(items);
        return items;
      });
    },
    async getMatch(id: string) {
      const stored = await repository.findMatch(id);

      if (stored) {
        return stored;
      }

      const matches = await this.listMatches();
      return matches.find((match) => match.id === id) ?? null;
    },
    async listLiveMatches() {
      return cache.getOrSet("live:matches", TTL.live, async () => {
        const items = await provider.fetchLiveScores();
        await repository.upsertMatches(items);
        return items;
      });
    },
    async getTeam(teamId: string) {
      return cache.getOrSet(`team:${teamId}`, TTL.team, async () => {
        const stored = await repository.findTeam(teamId);

        if (stored) {
          return stored;
        }

        const team = await provider.fetchTeam({ teamId });

        if (team) {
          await repository.upsertTeams([team]);
        }

        return team;
      });
    },
    async getTeamForm(teamId: string) {
      return cache.getOrSet(`team-form:${teamId}`, TTL.teamForm, async () => {
        const stored = await repository.listTeamForm(teamId);

        if (stored.length > 0) {
          return stored;
        }

        return provider.fetchTeamForm({ teamId });
      });
    },
    async answerQuery(query: string) {
      return cache.getOrSet(`ai:${query}`, TTL.ai, async () => {
        const [liveMatches, todayMatches, standings] = await Promise.all([
          this.listLiveMatches(),
          this.listMatches({ date: "today" }),
          this.getStandings("premier-league")
        ]);
        const teamRow = standings.find((row) => query.includes(row.teamName) || query.includes(row.teamId));

        if (teamRow) {
          const teamCards = todayMatches.filter(
            (match) => match.homeTeamId === teamRow.teamId || match.awayTeamId === teamRow.teamId
          );

          return {
            query,
            answer: `${teamRow.teamName} 当前排名第 ${teamRow.position}，${teamRow.played} 场拿到 ${teamRow.points} 分，近况为 ${formatForm(teamRow.form)}。`,
            cards: teamCards.slice(0, 3),
            grounded: true
          };
        }

        if (isLiveQuery(query)) {
          return {
            query,
            answer:
              liveMatches.length > 0
                ? `当前有 ${liveMatches.length} 场进行中的比赛。`
                : "当前没有进行中的比赛。",
            cards: liveMatches.slice(0, 3),
            grounded: true
          };
        }

        return {
          query,
          answer: `今天共有 ${todayMatches.length} 场比赛，其中 ${liveMatches.length} 场进行中。`,
          cards: todayMatches.slice(0, 3),
          grounded: true
        };
      });
    },
    async clearCache(prefix?: string) {
      await cache.clear(prefix);
    },
    getCacheSnapshot() {
      return cache.snapshot();
    },
    getRepositorySnapshot() {
      return repository.snapshot();
    }
  };
}

function isLiveQuery(query: string): boolean {
  return query.includes("进行中") || query.includes("现在") || query.toLowerCase().includes("live");
}

function formatForm(form: Array<"W" | "D" | "L">): string {
  if (form.length === 0) {
    return "暂无近期状态";
  }

  return form.join("-");
}
