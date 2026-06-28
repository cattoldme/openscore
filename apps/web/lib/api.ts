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
    const [today, standings] = await Promise.all([
      fetchJson<TodayResponse>(`${apiBaseUrl}/matches/today`),
      fetchJson<StandingsResponse>(`${apiBaseUrl}/competitions/premier-league/standings`)
    ]);

    return {
      apiAvailable: true,
      matches: today.data.matches,
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
    const [team, matches, standings] = await Promise.all([
      fetchJson<TeamResponse>(`${apiBaseUrl}/teams/${teamId}`),
      fetchJson<MatchSummary[]>(`${apiBaseUrl}/matches`),
      fetchJson<StandingsResponse>(`${apiBaseUrl}/competitions/premier-league/standings`)
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

async function fetchJson<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`OpenScore API request failed: ${response.status}`);
  }

  return response.json() as Promise<ApiResponse<T>>;
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
