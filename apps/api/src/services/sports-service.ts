import type { ProviderCode } from "@openscore/domain";
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

export function createSportsService(providerCode: ProviderCode, options: SportsDataProviderOptions = {}) {
  const provider = createSportsDataProvider(providerCode, options);
  const cache = new TtlCache();

  return {
    provider,
    cache,
    async listSports() {
      return cache.getOrSet("sports", TTL.sports, () => provider.fetchSports());
    },
    async listCompetitions() {
      return cache.getOrSet("competitions", TTL.competitions, () => provider.fetchCompetitions());
    },
    async getCompetition(id: string) {
      const competitions = await this.listCompetitions();
      return competitions.find((competition) => competition.id === id) ?? null;
    },
    async getStandings(competitionId: string) {
      return cache.getOrSet(`standings:${competitionId}`, TTL.standings, () => provider.fetchStandings({ competitionId }));
    },
    async listMatches(input: { date?: "today"; status?: string } = {}) {
      return cache.getOrSet(`matches:${JSON.stringify(input)}`, TTL.matches, () => provider.fetchFixtures(input));
    },
    async getMatch(id: string) {
      const matches = await this.listMatches();
      return matches.find((match) => match.id === id) ?? null;
    },
    async listLiveMatches() {
      return cache.getOrSet("live:matches", TTL.live, () => provider.fetchLiveScores());
    },
    async getTeam(teamId: string) {
      return cache.getOrSet(`team:${teamId}`, TTL.team, () => provider.fetchTeam({ teamId }));
    },
    async getTeamForm(teamId: string) {
      return cache.getOrSet(`team-form:${teamId}`, TTL.teamForm, () => provider.fetchTeamForm({ teamId }));
    },
    async answerQuery(query: string) {
      return cache.getOrSet(`ai:${query}`, TTL.ai, () => provider.answerQuery(query));
    },
    clearCache(prefix?: string) {
      cache.clear(prefix);
    },
    getCacheSnapshot() {
      return cache.snapshot();
    }
  };
}
