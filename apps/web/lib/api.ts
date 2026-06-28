import type { Competition, MatchSummary, StandingRow } from "@openscore/domain";

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

