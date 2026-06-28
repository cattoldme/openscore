import type { SportsRepository } from "@openscore/db";
import type { MatchSummary, StandingRow, Team } from "@openscore/domain";
import type { SportsDataProvider } from "@openscore/providers";

export type SyncJobStatus = "idle" | "running" | "succeeded" | "failed";

export type SyncJobSnapshot = {
  status: SyncJobStatus;
  provider: string;
  startedAt?: string;
  finishedAt?: string;
  itemsRead: number;
  error?: string;
};

export function createSyncRunner(provider: SportsDataProvider, repository: SportsRepository) {
  let snapshot: SyncJobSnapshot = {
    status: "idle",
    provider: provider.code,
    itemsRead: 0
  };

  return {
    getSnapshot() {
      return snapshot;
    },
    async runNow() {
      if (snapshot.status === "running") {
        return snapshot;
      }

      snapshot = {
        status: "running",
        provider: provider.code,
        startedAt: new Date().toISOString(),
        itemsRead: 0
      };

      try {
        const [sports, competitions, fixtures, standings] = await Promise.all([
          provider.fetchSports(),
          provider.fetchCompetitions(),
          provider.fetchFixtures({ date: "today" }),
          provider.fetchStandings({ competitionId: "premier-league" })
        ]);
        const teams = deriveTeams(fixtures, standings);

        await repository.upsertSports(sports);
        await repository.upsertCompetitions(competitions);
        await repository.upsertMatches(fixtures);
        await repository.upsertStandings("premier-league", standings);
        await repository.upsertTeams(teams);

        snapshot = {
          ...snapshot,
          status: "succeeded",
          finishedAt: new Date().toISOString(),
          itemsRead: sports.length + competitions.length + fixtures.length + standings.length + teams.length
        };
      } catch (error) {
        snapshot = {
          ...snapshot,
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error)
        };
      }

      return snapshot;
    }
  };
}

function deriveTeams(matches: MatchSummary[], standings: StandingRow[]): Team[] {
  const teams = new Map<string, Team>();

  for (const match of matches) {
    teams.set(match.homeTeamId, {
      id: match.homeTeamId,
      sportId: match.sportId,
      name: match.homeTeamName,
      shortName: match.homeTeamName,
      countryCode: "UN"
    });
    teams.set(match.awayTeamId, {
      id: match.awayTeamId,
      sportId: match.sportId,
      name: match.awayTeamName,
      shortName: match.awayTeamName,
      countryCode: "UN"
    });
  }

  for (const row of standings) {
    teams.set(row.teamId, {
      id: row.teamId,
      sportId: "football",
      name: row.teamName,
      shortName: row.teamName,
      countryCode: "UN"
    });
  }

  return Array.from(teams.values());
}
