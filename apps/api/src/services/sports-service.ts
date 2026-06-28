import type { ProviderCode } from "@openscore/domain";
import { createInMemorySportsRepository, type SportsRepository } from "@openscore/db";
import { createSportsDataProvider, type SportsDataProviderOptions } from "@openscore/providers";
import { TtlCache } from "./cache";

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
};

export function createSportsService(providerCode: ProviderCode, options: CreateSportsServiceOptions = {}) {
  const provider = createSportsDataProvider(providerCode, options);
  const repository = options.repository ?? createInMemorySportsRepository();
  const cache = new TtlCache();

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
      return cache.getOrSet(`ai:${query}`, TTL.ai, () => provider.answerQuery(query));
    },
    clearCache(prefix?: string) {
      cache.clear(prefix);
    },
    getCacheSnapshot() {
      return cache.snapshot();
    },
    getRepositorySnapshot() {
      return repository.snapshot();
    }
  };
}
