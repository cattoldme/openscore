import type { Competition, MatchStatus, MatchSummary, Sport, StandingRow, Team } from "@openscore/domain";
import type { SportsDataProvider } from "./types.ts";

export const mockSports: Sport[] = [
  {
    id: "football",
    code: "football",
    name: "足球"
  }
];

export const mockCompetitions: Competition[] = [
  {
    id: "premier-league",
    sportId: "football",
    name: "英格兰超级联赛",
    shortName: "英超",
    countryCode: "GB",
    type: "league"
  }
];

export const mockTeams: Team[] = [
  { id: "arsenal", sportId: "football", name: "阿森纳", shortName: "ARS", countryCode: "GB" },
  { id: "man-city", sportId: "football", name: "曼城", shortName: "MCI", countryCode: "GB" },
  { id: "liverpool", sportId: "football", name: "利物浦", shortName: "LIV", countryCode: "GB" },
  { id: "chelsea", sportId: "football", name: "切尔西", shortName: "CHE", countryCode: "GB" },
  { id: "tottenham", sportId: "football", name: "热刺", shortName: "TOT", countryCode: "GB" },
  { id: "man-united", sportId: "football", name: "曼联", shortName: "MUN", countryCode: "GB" }
];

const now = new Date();
const today = now.toISOString().slice(0, 10);

export const mockMatches: MatchSummary[] = [
  createMatch("match-001", "arsenal", "chelsea", `${today}T11:30:00.000Z`, "live", 63, 2, 1),
  createMatch("match-002", "man-city", "tottenham", `${today}T14:00:00.000Z`, "scheduled", undefined, 0, 0),
  createMatch("match-003", "liverpool", "man-united", `${today}T16:30:00.000Z`, "scheduled", undefined, 0, 0),
  createMatch("match-004", "chelsea", "tottenham", `${today}T08:00:00.000Z`, "finished", 90, 1, 1)
];

export const mockStandings: StandingRow[] = [
  row("arsenal", 1, 20, 14, 4, 2, 43, 19, ["W", "W", "D", "W", "L"]),
  row("man-city", 2, 20, 13, 5, 2, 46, 21, ["W", "D", "W", "W", "W"]),
  row("liverpool", 3, 20, 12, 5, 3, 41, 22, ["D", "W", "L", "W", "D"]),
  row("chelsea", 4, 20, 10, 6, 4, 36, 24, ["D", "W", "W", "L", "W"]),
  row("tottenham", 5, 20, 9, 5, 6, 34, 29, ["L", "D", "W", "L", "W"]),
  row("man-united", 6, 20, 8, 4, 8, 30, 30, ["W", "L", "D", "L", "W"])
];

export function createMockProvider(): SportsDataProvider {
  return {
    code: "mock",
    async fetchSports() {
      return mockSports;
    },
    async fetchCompetitions() {
      return mockCompetitions;
    },
    async fetchFixtures(input = {}) {
      return getMatchList(input);
    },
    async fetchLiveScores() {
      return getLiveMatches();
    },
    async fetchStandings(input) {
      return getCompetitionStandings(input.competitionId);
    },
    async fetchTeam(input) {
      return findTeamById(input.teamId) ?? null;
    },
    async fetchTeamForm(input) {
      return getTeamForm(input.teamId);
    },
    async answerQuery(query) {
      const liveMatches = getLiveMatches();
      const todayMatches = getMatchList({ date: "today" });

      return {
        query,
        answer:
          liveMatches.length > 0
            ? `当前有 ${liveMatches.length} 场进行中的模拟比赛。OpenScore 已基于本地 mock 数据返回结果，后续会替换为真实数据源。`
            : `今天共有 ${todayMatches.length} 场模拟比赛。当前 AI 查询处于 grounded mock 模式，不会编造外部实时比分。`,
        cards: todayMatches.slice(0, 3),
        grounded: true
      };
    }
  };
}

export function findCompetitionById(id: string): Competition | undefined {
  return mockCompetitions.find((competition) => competition.id === id);
}

export function findMatchById(id: string): MatchSummary | undefined {
  return mockMatches.find((match) => match.id === id);
}

export function findTeamById(id: string): Team | undefined {
  return mockTeams.find((team) => team.id === id);
}

export function getMatchList(input: { date?: "today"; status?: string } = {}): MatchSummary[] {
  if (input.status) {
    return mockMatches.filter((match) => match.status === input.status);
  }

  return mockMatches;
}

export function getLiveMatches(): MatchSummary[] {
  return mockMatches.filter((match) => match.status === "live");
}

export function getCompetitionStandings(competitionId: string): StandingRow[] {
  if (competitionId !== "premier-league") {
    return [];
  }

  return mockStandings;
}

export function getTeamForm(teamId: string): Array<"W" | "D" | "L"> {
  return mockStandings.find((standing) => standing.teamId === teamId)?.form ?? [];
}

function createMatch(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  startsAt: string,
  status: MatchStatus,
  minute: number | undefined,
  homeScore: number,
  awayScore: number
): MatchSummary {
  const homeTeam = requiredTeam(homeTeamId);
  const awayTeam = requiredTeam(awayTeamId);
  const competition = mockCompetitions[0];

  if (!competition) {
    throw new Error("Mock competition is required.");
  }

  return {
    id,
    sportId: "football",
    competitionId: competition.id,
    competitionName: competition.shortName,
    homeTeamId: homeTeam.id,
    homeTeamName: homeTeam.name,
    awayTeamId: awayTeam.id,
    awayTeamName: awayTeam.name,
    startsAt,
    status,
    minute,
    homeScore,
    awayScore,
    updatedAt: now.toISOString()
  };
}

function row(
  teamId: string,
  position: number,
  played: number,
  won: number,
  drawn: number,
  lost: number,
  goalsFor: number,
  goalsAgainst: number,
  form: Array<"W" | "D" | "L">
): StandingRow {
  const team = requiredTeam(teamId);

  return {
    teamId,
    teamName: team.name,
    position,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: won * 3 + drawn,
    form
  };
}

function requiredTeam(id: string): Team {
  const team = mockTeams.find((item) => item.id === id);

  if (!team) {
    throw new Error(`Unknown mock team: ${id}`);
  }

  return team;
}
