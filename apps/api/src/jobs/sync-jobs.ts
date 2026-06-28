import type { SportsRepository } from "@openscore/db";
import type { MatchSummary, StandingRow, Team } from "@openscore/domain";
import type { SportsDataProvider } from "@openscore/providers";
import { MemorySyncLock, type SyncLock, type SyncLockSnapshot } from "../services/sync-lock";

export type SyncJobStatus = "idle" | "running" | "succeeded" | "failed" | "skipped";

export type SyncJobSnapshot = {
  status: SyncJobStatus;
  provider: string;
  lock: SyncLockSnapshot;
  startedAt?: string;
  finishedAt?: string;
  itemsRead: number;
  error?: string;
};

export type CreateSyncRunnerOptions = {
  lock?: SyncLock;
  lockKey?: string;
  lockTtlMs?: number;
};

const DEFAULT_LOCK_KEY = "sync:run";
const DEFAULT_LOCK_TTL_MS = 2 * 60 * 1000;

export function createSyncRunner(
  provider: SportsDataProvider,
  repository: SportsRepository,
  options: CreateSyncRunnerOptions = {}
) {
  const lock = options.lock ?? new MemorySyncLock();
  const lockKey = options.lockKey ?? DEFAULT_LOCK_KEY;
  const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  let snapshot: SyncJobSnapshot = {
    status: "idle",
    provider: provider.code,
    lock: buildLockSnapshot(lock.provider, lockKey, lockTtlMs, false),
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

      const lease = await lock.acquire(lockKey, lockTtlMs);

      if (!lease) {
        snapshot = {
          status: "skipped",
          provider: provider.code,
          lock: buildLockSnapshot(lock.provider, lockKey, lockTtlMs, false),
          finishedAt: new Date().toISOString(),
          itemsRead: 0,
          error: "Sync is already running."
        };

        return snapshot;
      }

      snapshot = {
        status: "running",
        provider: provider.code,
        lock: buildLockSnapshot(lock.provider, lockKey, lockTtlMs, true, lease),
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
      } finally {
        try {
          await lease.release();
        } catch (error) {
          snapshot = {
            ...snapshot,
            error: appendError(snapshot.error, `Lock release failed: ${error instanceof Error ? error.message : String(error)}`)
          };
        }

        snapshot = {
          ...snapshot,
          lock: buildLockSnapshot(lock.provider, lockKey, lockTtlMs, false)
        };
      }

      return snapshot;
    }
  };
}

function buildLockSnapshot(
  provider: SyncLockSnapshot["provider"],
  key: string,
  ttlMs: number,
  acquired: boolean,
  lease?: { acquiredAt: string; expiresAt: string }
): SyncLockSnapshot {
  return {
    provider,
    key,
    ttlMs,
    acquired,
    acquiredAt: lease?.acquiredAt,
    expiresAt: lease?.expiresAt,
    updatedAt: new Date().toISOString()
  };
}

function appendError(current: string | undefined, next: string) {
  return current ? `${current}; ${next}` : next;
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
