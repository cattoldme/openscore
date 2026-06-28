import type { Competition, MatchSummary, Sport, StandingRow, Team } from "@openscore/domain";

export type MatchListQuery = {
  date?: "today";
  status?: string;
};

export type RepositorySnapshot = {
  sports: number;
  competitions: number;
  matches: number;
  standings: number;
  teams: number;
};

export type SportsRepository = {
  upsertSports(sports: Sport[]): Promise<void>;
  upsertCompetitions(competitions: Competition[]): Promise<void>;
  upsertMatches(matches: MatchSummary[]): Promise<void>;
  upsertStandings(competitionId: string, rows: StandingRow[]): Promise<void>;
  upsertTeams(teams: Team[]): Promise<void>;
  listSports(): Promise<Sport[]>;
  listCompetitions(): Promise<Competition[]>;
  findCompetition(id: string): Promise<Competition | null>;
  listMatches(query?: MatchListQuery): Promise<MatchSummary[]>;
  findMatch(id: string): Promise<MatchSummary | null>;
  listStandings(competitionId: string): Promise<StandingRow[]>;
  findTeam(id: string): Promise<Team | null>;
  listTeamForm(teamId: string): Promise<Array<"W" | "D" | "L">>;
  snapshot(): RepositorySnapshot;
};

export function createInMemorySportsRepository(): SportsRepository {
  const sports = new Map<string, Sport>();
  const competitions = new Map<string, Competition>();
  const matches = new Map<string, MatchSummary>();
  const standings = new Map<string, StandingRow[]>();
  const teams = new Map<string, Team>();

  return {
    async upsertSports(items) {
      for (const item of items) {
        sports.set(item.id, item);
      }
    },
    async upsertCompetitions(items) {
      for (const item of items) {
        competitions.set(item.id, item);
      }
    },
    async upsertMatches(items) {
      for (const item of items) {
        matches.set(item.id, item);
      }
    },
    async upsertStandings(competitionId, rows) {
      standings.set(competitionId, rows);
    },
    async upsertTeams(items) {
      for (const item of items) {
        teams.set(item.id, item);
      }
    },
    async listSports() {
      return Array.from(sports.values());
    },
    async listCompetitions() {
      return Array.from(competitions.values());
    },
    async findCompetition(id) {
      return competitions.get(id) ?? null;
    },
    async listMatches(query = {}) {
      let items = Array.from(matches.values());

      if (query.date === "today") {
        const today = new Date().toISOString().slice(0, 10);
        items = items.filter((match) => match.startsAt.slice(0, 10) === today);
      }

      if (query.status) {
        items = items.filter((match) => match.status === query.status);
      }

      return items.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    },
    async findMatch(id) {
      return matches.get(id) ?? null;
    },
    async listStandings(competitionId) {
      return standings.get(competitionId) ?? [];
    },
    async findTeam(id) {
      return teams.get(id) ?? null;
    },
    async listTeamForm(teamId) {
      for (const rows of standings.values()) {
        const row = rows.find((item) => item.teamId === teamId);

        if (row) {
          return row.form;
        }
      }

      return [];
    },
    snapshot() {
      return {
        sports: sports.size,
        competitions: competitions.size,
        matches: matches.size,
        standings: Array.from(standings.values()).reduce((total, rows) => total + rows.length, 0),
        teams: teams.size
      };
    }
  };
}
