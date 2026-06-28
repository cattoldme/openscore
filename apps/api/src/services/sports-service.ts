import type { ProviderCode } from "@openscore/domain";
import { createSportsDataProvider } from "@openscore/providers";

export function createSportsService(providerCode: ProviderCode) {
  const provider = createSportsDataProvider(providerCode);

  return {
    provider,
    async listSports() {
      return provider.fetchSports();
    },
    async listCompetitions() {
      return provider.fetchCompetitions();
    },
    async getCompetition(id: string) {
      const competitions = await provider.fetchCompetitions();
      return competitions.find((competition) => competition.id === id) ?? null;
    },
    async getStandings(competitionId: string) {
      return provider.fetchStandings({ competitionId });
    },
    async listMatches(input: { date?: "today"; status?: string } = {}) {
      return provider.fetchFixtures(input);
    },
    async getMatch(id: string) {
      const matches = await provider.fetchFixtures();
      return matches.find((match) => match.id === id) ?? null;
    },
    async listLiveMatches() {
      return provider.fetchLiveScores();
    },
    async getTeam(teamId: string) {
      return provider.fetchTeam({ teamId });
    },
    async getTeamForm(teamId: string) {
      return provider.fetchTeamForm({ teamId });
    },
    async answerQuery(query: string) {
      return provider.answerQuery(query);
    }
  };
}

