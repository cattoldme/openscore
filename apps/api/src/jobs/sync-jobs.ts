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

export function createSyncRunner(provider: SportsDataProvider) {
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
        const [competitions, fixtures, standings] = await Promise.all([
          provider.fetchCompetitions(),
          provider.fetchFixtures({ date: "today" }),
          provider.fetchStandings({ competitionId: "premier-league" })
        ]);

        snapshot = {
          ...snapshot,
          status: "succeeded",
          finishedAt: new Date().toISOString(),
          itemsRead: competitions.length + fixtures.length + standings.length
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
