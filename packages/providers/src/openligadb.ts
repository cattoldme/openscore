import type { Competition, MatchStatus, MatchSummary, Sport, StandingRow, Team } from "@openscore/domain";
import type { OpenLigaDbProviderOptions, SportsDataProvider } from "./types.ts";

const DEFAULT_BASE_URL = "https://api.openligadb.de";
const DEFAULT_LEAGUE = "bl1";
const COMPETITION_ID_BY_LEAGUE: Record<string, string> = {
  bl1: "bundesliga",
  bl2: "2-bundesliga",
  bl3: "3-liga"
};
const COMPETITION_NAME_BY_LEAGUE: Record<string, string> = {
  bl1: "1. Bundesliga",
  bl2: "2. Bundesliga",
  bl3: "3. Liga"
};

export function createOpenLigaDbProvider(options: OpenLigaDbProviderOptions = {}): SportsDataProvider {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
  const leagueShortcut = (options.leagueShortcut ?? DEFAULT_LEAGUE).trim().toLowerCase();
  const season = options.season ?? inferSeasonStartYear(new Date());
  const competition = buildCompetition(leagueShortcut, season);

  return {
    code: "openligadb",
    async fetchSports() {
      return footballSports;
    },
    async fetchCompetitions() {
      return [competition];
    },
    async fetchFixtures(input = {}) {
      const matches = await fetchSeasonMatches(baseUrl, leagueShortcut, season);

      return matches.filter((match) => matchesFixtureQuery(match, input)).map((match) => mapMatch(match, competition));
    },
    async fetchLiveScores() {
      const matches = await fetchSeasonMatches(baseUrl, leagueShortcut, season);

      return matches.filter((match) => mapMatchStatus(match) === "live").map((match) => mapMatch(match, competition));
    },
    async fetchStandings() {
      const rows = await requestJson<OpenLigaDbTableRow[]>(baseUrl, `/getbltable/${leagueShortcut}/${season}`);

      return rows.map(mapStandingRow);
    },
    async fetchTeam(input) {
      const teamId = parseTeamId(input.teamId);

      if (teamId === null) {
        return null;
      }

      const teams = await requestJson<OpenLigaDbTeam[]>(baseUrl, `/getavailableteams/${leagueShortcut}/${season}`);
      const team = teams.find((item) => item.teamId === teamId);

      return team ? mapTeam(team) : null;
    },
    async fetchTeamForm(input) {
      const teamId = parseTeamId(input.teamId);

      if (teamId === null) {
        return [];
      }

      const matches = await fetchSeasonMatches(baseUrl, leagueShortcut, season);

      return matches
        .filter((match) => match.matchIsFinished && (match.team1.teamId === teamId || match.team2.teamId === teamId))
        .sort((a, b) => toTimestamp(b.matchDateTimeUTC ?? b.matchDateTime) - toTimestamp(a.matchDateTimeUTC ?? a.matchDateTime))
        .slice(0, 5)
        .map((match) => resultForTeam(match, teamId))
        .filter((result): result is "W" | "D" | "L" => result !== null);
    },
    async answerQuery(query) {
      const [liveMatches, todayMatches, standings] = await Promise.all([
        this.fetchLiveScores(),
        this.fetchFixtures({ date: "today" }),
        this.fetchStandings({ competitionId: competition.id })
      ]);
      const teamRow = standings.find((row) => query.includes(row.teamName) || query.includes(row.teamId));

      if (teamRow) {
        return {
          query,
          answer: `${teamRow.teamName} 当前在 ${competition.name} 排名第 ${teamRow.position}，${teamRow.played} 场 ${teamRow.points} 分。`,
          cards: todayMatches.filter((match) => match.homeTeamId === teamRow.teamId || match.awayTeamId === teamRow.teamId).slice(0, 3),
          grounded: true
        };
      }

      return {
        query,
        answer:
          liveMatches.length > 0
            ? `OpenLigaDB 当前返回 ${liveMatches.length} 场进行中的 ${competition.name} 比赛。`
            : `今天 ${competition.name} 有 ${todayMatches.length} 场比赛。`,
        cards: liveMatches.length > 0 ? liveMatches.slice(0, 3) : todayMatches.slice(0, 3),
        grounded: true
      };
    }
  };
}

type OpenLigaDbTeam = {
  teamId: number;
  teamName: string;
  shortName?: string | null;
  teamIconUrl?: string | null;
};

type OpenLigaDbMatchResult = {
  pointsTeam1: number;
  pointsTeam2: number;
  resultOrderID: number;
  resultTypeID: number;
};

type OpenLigaDbMatch = {
  matchID: number;
  matchDateTime: string;
  matchDateTimeUTC?: string | null;
  leagueName: string;
  leagueSeason: number;
  leagueShortcut: string;
  team1: OpenLigaDbTeam;
  team2: OpenLigaDbTeam;
  lastUpdateDateTime?: string | null;
  matchIsFinished: boolean;
  matchResults?: OpenLigaDbMatchResult[];
};

type OpenLigaDbTableRow = {
  teamInfoId: number;
  teamName: string;
  shortName?: string | null;
  teamIconUrl?: string | null;
  points: number;
  opponentGoals: number;
  goals: number;
  matches: number;
  won: number;
  lost: number;
  draw: number;
  goalDiff: number;
};

const footballSports: Sport[] = [
  {
    id: "football",
    code: "football",
    name: "足球"
  }
];

async function fetchSeasonMatches(baseUrl: string, leagueShortcut: string, season: number): Promise<OpenLigaDbMatch[]> {
  return requestJson<OpenLigaDbMatch[]>(baseUrl, `/getmatchdata/${leagueShortcut}/${season}`);
}

async function requestJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenLigaDB request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  return (await response.json()) as T;
}

function buildCompetition(leagueShortcut: string, season: number): Competition {
  const id = COMPETITION_ID_BY_LEAGUE[leagueShortcut] ?? `openligadb-${leagueShortcut}`;
  const name = COMPETITION_NAME_BY_LEAGUE[leagueShortcut] ?? leagueShortcut.toUpperCase();

  return {
    id,
    sportId: "football",
    name: `${name} ${season}/${season + 1}`,
    shortName: leagueShortcut.toUpperCase(),
    countryCode: "DE",
    type: "league"
  };
}

function mapMatch(match: OpenLigaDbMatch, competition: Competition): MatchSummary {
  const result = findFinalResult(match);

  return {
    id: `ol-${match.matchID}`,
    sportId: "football",
    competitionId: competition.id,
    competitionName: competition.shortName,
    homeTeamId: toTeamId(match.team1.teamId),
    homeTeamName: match.team1.teamName,
    awayTeamId: toTeamId(match.team2.teamId),
    awayTeamName: match.team2.teamName,
    startsAt: toIsoString(match.matchDateTimeUTC ?? match.matchDateTime),
    status: mapMatchStatus(match),
    homeScore: result?.pointsTeam1 ?? 0,
    awayScore: result?.pointsTeam2 ?? 0,
    updatedAt: toIsoString(match.lastUpdateDateTime ?? match.matchDateTimeUTC ?? match.matchDateTime)
  };
}

function mapStandingRow(row: OpenLigaDbTableRow, index: number): StandingRow {
  return {
    teamId: toTeamId(row.teamInfoId),
    teamName: row.teamName,
    position: index + 1,
    played: row.matches,
    won: row.won,
    drawn: row.draw,
    lost: row.lost,
    goalsFor: row.goals,
    goalsAgainst: row.opponentGoals,
    goalDifference: row.goalDiff,
    points: row.points,
    form: []
  };
}

function mapTeam(team: OpenLigaDbTeam): Team {
  return {
    id: toTeamId(team.teamId),
    sportId: "football",
    name: team.teamName,
    shortName: team.shortName ?? team.teamName,
    countryCode: "DE",
    logoUrl: team.teamIconUrl ?? undefined
  };
}

function matchesFixtureQuery(match: OpenLigaDbMatch, input: { date?: "today"; status?: string }): boolean {
  if (input.date === "today" && toDateKey(match.matchDateTimeUTC ?? match.matchDateTime) !== toDateKey(new Date().toISOString())) {
    return false;
  }

  if (input.status && mapMatchStatus(match) !== normalizeStatus(input.status)) {
    return false;
  }

  return true;
}

function mapMatchStatus(match: OpenLigaDbMatch): MatchStatus {
  if (match.matchIsFinished) {
    return "finished";
  }

  const startsAt = toTimestamp(match.matchDateTimeUTC ?? match.matchDateTime);
  const now = Date.now();

  if (startsAt <= now && now <= startsAt + 3 * 60 * 60 * 1000) {
    return "live";
  }

  return "scheduled";
}

function normalizeStatus(status: string): MatchStatus {
  const normalized = status.toLowerCase();

  if (
    normalized === "scheduled" ||
    normalized === "live" ||
    normalized === "paused" ||
    normalized === "finished" ||
    normalized === "postponed" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }

  return "unknown";
}

function findFinalResult(match: OpenLigaDbMatch): OpenLigaDbMatchResult | undefined {
  return (match.matchResults ?? [])
    .slice()
    .sort((a, b) => b.resultTypeID - a.resultTypeID || b.resultOrderID - a.resultOrderID)[0];
}

function resultForTeam(match: OpenLigaDbMatch, teamId: number): "W" | "D" | "L" | null {
  const result = findFinalResult(match);

  if (!result) {
    return null;
  }

  const isHome = match.team1.teamId === teamId;
  const goalsFor = isHome ? result.pointsTeam1 : result.pointsTeam2;
  const goalsAgainst = isHome ? result.pointsTeam2 : result.pointsTeam1;

  if (goalsFor > goalsAgainst) {
    return "W";
  }

  if (goalsFor < goalsAgainst) {
    return "L";
  }

  return "D";
}

function toTeamId(teamId: number): string {
  return `ol-${teamId}`;
}

function parseTeamId(teamId: string): number | null {
  const normalized = teamId.replace(/^ol-/, "");

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized, 10);
}

function toDateKey(value: string): string {
  return toIsoString(value).slice(0, 10);
}

function toTimestamp(value: string): number {
  return new Date(toIsoString(value)).getTime();
}

function toIsoString(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");

  if (normalized === "https://www.openligadb.de/api" || normalized === "https://www.openligadb.de") {
    return DEFAULT_BASE_URL;
  }

  return normalized.replace(/\/api$/, "");
}

function inferSeasonStartYear(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  return month >= 8 ? year : year - 1;
}
