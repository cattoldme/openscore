import type { Competition, MatchSummary, StandingRow, Team } from "@openscore/domain";

type ApiResponse<T> = {
  data: T;
  meta: {
    source: string;
    updatedAt: string;
  };
};

type TodayResponse = {
  date: string;
  matches: MatchSummary[];
};

type StandingsResponse = {
  competition: Competition;
  rows: StandingRow[];
};

type TeamResponse = {
  team: Team;
  form: Array<"W" | "D" | "L">;
};

export type AiQueryResult = {
  query: string;
  answer: string;
  cards: MatchSummary[];
  grounded: boolean;
};

export type AiQueryApiResponse = ApiResponse<AiQueryResult>;

export type TeamPageData = {
  apiAvailable: boolean;
  team: Team | null;
  form: Array<"W" | "D" | "L">;
  matches: MatchSummary[];
  standingsRow: StandingRow | null;
  updatedAtLabel: string;
};

export async function getHomeData() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

  try {
    const competitionId = await getPrimaryCompetitionId(apiBaseUrl);
    const [today, recentResults, upcomingFixtures, standings] = await Promise.all([
      fetchJson<TodayResponse>(`${apiBaseUrl}/matches/today`),
      fetchJson<MatchSummary[]>(`${apiBaseUrl}/matches?status=finished`),
      fetchJson<MatchSummary[]>(`${apiBaseUrl}/matches?status=scheduled`),
      fetchJson<StandingsResponse>(`${apiBaseUrl}/competitions/${competitionId}/standings`)
    ]);

    return {
      apiAvailable: true,
      matches: today.data.matches,
      recentResults: recentResults.data.slice(0, 6),
      upcomingFixtures: upcomingFixtures.data.slice(0, 6),
      standings: standings.data,
      teamForms: buildTeamForms(today.data.matches),
      updatedAtLabel: new Date(today.meta.updatedAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };
  } catch {
    return {
      apiAvailable: false,
      matches: [],
      recentResults: [],
      upcomingFixtures: [],
      standings: {
        competition: {
          id: "premier-league",
          sportId: "football",
          name: "等待 API 启动",
          shortName: "API",
          countryCode: "GB",
          type: "league"
        },
        rows: []
      },
      teamForms: [],
      updatedAtLabel: "--:--"
    };
  }
}

export async function getTeamPageData(teamId: string): Promise<TeamPageData> {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

  try {
    const competitionId = await getPrimaryCompetitionId(apiBaseUrl);
    const [team, matches, standings] = await Promise.all([
      fetchJson<TeamResponse>(`${apiBaseUrl}/teams/${teamId}`),
      fetchJson<MatchSummary[]>(`${apiBaseUrl}/matches`),
      fetchJson<StandingsResponse>(`${apiBaseUrl}/competitions/${competitionId}/standings`)
    ]);

    return {
      apiAvailable: true,
      team: team.data.team,
      form: team.data.form,
      matches: matches.data.filter((match) => match.homeTeamId === teamId || match.awayTeamId === teamId),
      standingsRow: standings.data.rows.find((row) => row.teamId === teamId) ?? null,
      updatedAtLabel: new Date(team.meta.updatedAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };
  } catch {
    return {
      apiAvailable: false,
      team: null,
      form: [],
      matches: [],
      standingsRow: null,
      updatedAtLabel: "--:--"
    };
  }
}

export async function querySportsData(query: string): Promise<AiQueryApiResponse> {
  const apiBaseUrl = getBrowserApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/ai/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    throw new Error(`OpenScore AI query failed: ${response.status}`);
  }

  return response.json() as Promise<AiQueryApiResponse>;
}

async function fetchJson<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`OpenScore API request failed: ${response.status}`);
  }

  return response.json() as Promise<ApiResponse<T>>;
}

async function getPrimaryCompetitionId(apiBaseUrl: string): Promise<string> {
  const competitions = await fetchJson<Competition[]>(`${apiBaseUrl}/competitions`);
  return competitions.data[0]?.id ?? "premier-league";
}

function getBrowserApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

function buildTeamForms(matches: MatchSummary[]) {
  const teams = new Map<string, { id: string; name: string; competition: string; form: Array<"W" | "D" | "L"> }>();

  for (const match of matches) {
    if (!teams.has(match.homeTeamId)) {
      teams.set(match.homeTeamId, {
        id: match.homeTeamId,
        name: match.homeTeamName,
        competition: match.competitionName,
        form: match.homeScore >= match.awayScore ? ["W", "D", "W", "L", "W"] : ["L", "W", "D", "W", "D"]
      });
    }

    if (teams.size >= 3) {
      break;
    }
  }

  return Array.from(teams.values());
}
