import type { Competition, MatchStatus, MatchSummary, Sport, StandingRow, Team } from "@openscore/domain";
import type { FootballDataProviderOptions, SportsDataProvider } from "./types";

const DEFAULT_BASE_URL = "https://api.football-data.org/v4";
const DEFAULT_COMPETITIONS = ["PL"];
const COMPETITION_ID_BY_CODE: Record<string, string> = {
  PL: "premier-league"
};
const COMPETITION_CODE_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(COMPETITION_ID_BY_CODE).map(([code, id]) => [id, code])
);

export function createFootballDataProvider(options: FootballDataProviderOptions = {}): SportsDataProvider {
  const apiKey = options.apiKey?.trim() ?? "";
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
  const competitionCodes =
    options.competitionCodes?.map((code) => code.trim().toUpperCase()).filter(Boolean) ?? DEFAULT_COMPETITIONS;

  return {
    code: "football_data",
    async fetchSports() {
      return footballSports;
    },
    async fetchCompetitions() {
      const payload = await requestJson<FootballDataCompetitionsResponse>(baseUrl, "/competitions", apiKey);
      const allowedCodes = new Set(competitionCodes);

      return (payload.competitions ?? [])
        .filter((competition) => !competition.code || allowedCodes.has(competition.code))
        .map(mapCompetition);
    },
    async fetchFixtures(input = {}) {
      const params = new URLSearchParams();
      const codes = competitionCodes.join(",");

      if (codes) {
        params.set("competitions", codes);
      }

      if (input.date === "today") {
        const today = new Date().toISOString().slice(0, 10);
        params.set("dateFrom", today);
        params.set("dateTo", today);
      }

      if (input.status) {
        params.set("status", mapStatusToFootballData(input.status));
      }

      const payload = await requestJson<FootballDataMatchesResponse>(baseUrl, `/matches?${params.toString()}`, apiKey);

      return (payload.matches ?? []).map(mapMatch);
    },
    async fetchLiveScores() {
      const params = new URLSearchParams({
        status: "LIVE"
      });
      const codes = competitionCodes.join(",");

      if (codes) {
        params.set("competitions", codes);
      }

      const payload = await requestJson<FootballDataMatchesResponse>(baseUrl, `/matches?${params.toString()}`, apiKey);

      return (payload.matches ?? []).map(mapMatch);
    },
    async fetchStandings(input) {
      const code = competitionCodeFromId(input.competitionId);
      const payload = await requestJson<FootballDataStandingsResponse>(baseUrl, `/competitions/${code}/standings`, apiKey);
      const total = payload.standings?.find((standing) => standing.type === "TOTAL") ?? payload.standings?.[0];

      return (total?.table ?? []).map(mapStandingRow);
    },
    async fetchTeam(input) {
      const teamId = input.teamId.replace(/^fd-/, "");

      if (!teamId || !/^\d+$/.test(teamId)) {
        return null;
      }

      const team = await requestJson<FootballDataTeam>(baseUrl, `/teams/${teamId}`, apiKey);

      return mapTeam(team);
    },
    async fetchTeamForm(input) {
      const teamId = input.teamId.startsWith("fd-") ? input.teamId : `fd-${input.teamId}`;
      const standings = await this.fetchStandings({ competitionId: "premier-league" });

      return standings.find((row) => row.teamId === teamId)?.form ?? [];
    },
    async answerQuery(query) {
      const [liveMatches, todayMatches] = await Promise.all([this.fetchLiveScores(), this.fetchFixtures({ date: "today" })]);

      return {
        query,
        answer:
          liveMatches.length > 0
            ? `当前 football-data 返回 ${liveMatches.length} 场进行中的比赛。`
            : `当前没有进行中的比赛；今天 football-data 返回 ${todayMatches.length} 场比赛。`,
        cards: liveMatches.length > 0 ? liveMatches.slice(0, 3) : todayMatches.slice(0, 3),
        grounded: true
      };
    }
  };
}

type FootballDataArea = {
  code?: string;
  name?: string;
};

type FootballDataCompetition = {
  id: number;
  area?: FootballDataArea;
  name: string;
  code?: string;
  type?: string;
  emblem?: string;
};

type FootballDataCompetitionsResponse = {
  competitions?: FootballDataCompetition[];
};

type FootballDataTeamBrief = {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
};

type FootballDataScore = {
  fullTime?: {
    home?: number | null;
    away?: number | null;
  };
};

type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  minute?: number;
  lastUpdated?: string;
  competition: FootballDataCompetition;
  homeTeam: FootballDataTeamBrief;
  awayTeam: FootballDataTeamBrief;
  score?: FootballDataScore;
};

type FootballDataMatchesResponse = {
  matches?: FootballDataMatch[];
};

type FootballDataStandingTableRow = {
  position: number;
  team: FootballDataTeamBrief;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string;
};

type FootballDataStandingsResponse = {
  standings?: Array<{
    type: string;
    table: FootballDataStandingTableRow[];
  }>;
};

type FootballDataTeam = FootballDataTeamBrief & {
  area?: FootballDataArea;
};

const footballSports: Sport[] = [
  {
    id: "football",
    code: "football",
    name: "足球"
  }
];

async function requestJson<T>(baseUrl: string, path: string, apiKey: string): Promise<T> {
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY is required when SPORTS_PROVIDER=football_data.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "X-Auth-Token": apiKey
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`football-data request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  return (await response.json()) as T;
}

function mapCompetition(competition: FootballDataCompetition): Competition {
  const code = competition.code?.toUpperCase() || String(competition.id);

  return {
    id: COMPETITION_ID_BY_CODE[code] ?? code.toLowerCase(),
    sportId: "football",
    name: competition.name,
    shortName: code,
    countryCode: competition.area?.code ?? "UN",
    type: competition.type === "LEAGUE" ? "league" : "unknown",
    logoUrl: competition.emblem
  };
}

function mapMatch(match: FootballDataMatch): MatchSummary {
  const competition = mapCompetition(match.competition);

  return {
    id: `fd-${match.id}`,
    sportId: "football",
    competitionId: competition.id,
    competitionName: competition.shortName,
    homeTeamId: `fd-${match.homeTeam.id}`,
    homeTeamName: match.homeTeam.name,
    awayTeamId: `fd-${match.awayTeam.id}`,
    awayTeamName: match.awayTeam.name,
    startsAt: match.utcDate,
    status: mapMatchStatus(match.status),
    minute: match.minute,
    homeScore: match.score?.fullTime?.home ?? 0,
    awayScore: match.score?.fullTime?.away ?? 0,
    updatedAt: match.lastUpdated ?? new Date().toISOString()
  };
}

function mapStandingRow(row: FootballDataStandingTableRow): StandingRow {
  return {
    teamId: `fd-${row.team.id}`,
    teamName: row.team.name,
    position: row.position,
    played: row.playedGames,
    won: row.won,
    drawn: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
    form: parseForm(row.form)
  };
}

function mapTeam(team: FootballDataTeam): Team {
  return {
    id: `fd-${team.id}`,
    sportId: "football",
    name: team.name,
    shortName: team.tla ?? team.shortName ?? team.name,
    countryCode: team.area?.code ?? "UN",
    logoUrl: team.crest
  };
}

function mapMatchStatus(status: string): MatchStatus {
  const normalized = status.toUpperCase();

  if (normalized === "SCHEDULED" || normalized === "TIMED") {
    return "scheduled";
  }

  if (normalized === "IN_PLAY" || normalized === "LIVE") {
    return "live";
  }

  if (normalized === "PAUSED") {
    return "paused";
  }

  if (normalized === "FINISHED") {
    return "finished";
  }

  if (normalized === "POSTPONED") {
    return "postponed";
  }

  if (normalized === "CANCELLED" || normalized === "SUSPENDED") {
    return "cancelled";
  }

  return "unknown";
}

function mapStatusToFootballData(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "scheduled") {
    return "SCHEDULED";
  }

  if (normalized === "live") {
    return "LIVE";
  }

  if (normalized === "paused") {
    return "PAUSED";
  }

  if (normalized === "finished") {
    return "FINISHED";
  }

  if (normalized === "postponed") {
    return "POSTPONED";
  }

  if (normalized === "cancelled") {
    return "CANCELLED";
  }

  return status.toUpperCase();
}

function competitionCodeFromId(competitionId: string): string {
  return COMPETITION_CODE_BY_ID[competitionId] ?? competitionId.toUpperCase();
}

function parseForm(form?: string): Array<"W" | "D" | "L"> {
  return (form ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is "W" | "D" | "L" => item === "W" || item === "D" || item === "L");
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}
