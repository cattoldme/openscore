export type MatchStatus =
  | "scheduled"
  | "live"
  | "paused"
  | "finished"
  | "postponed"
  | "cancelled"
  | "unknown";

export type CompetitionType = "league" | "cup" | "friendly" | "international" | "unknown";

export type ProviderCode = "mock" | "football_data" | "thesportsdb" | "openligadb" | "openfootball";

export type Sport = {
  id: string;
  code: string;
  name: string;
};

export type Competition = {
  id: string;
  sportId: string;
  name: string;
  shortName: string;
  countryCode: string;
  type: CompetitionType;
  logoUrl?: string;
};

export type Team = {
  id: string;
  sportId: string;
  name: string;
  shortName: string;
  countryCode: string;
  logoUrl?: string;
};

export type MatchSummary = {
  id: string;
  sportId: string;
  competitionId: string;
  competitionName: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  startsAt: string;
  status: MatchStatus;
  minute?: number;
  homeScore: number;
  awayScore: number;
  updatedAt: string;
};

export type StandingRow = {
  teamId: string;
  teamName: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: Array<"W" | "D" | "L">;
};

export function getMatchStatusLabel(status: MatchStatus): string {
  const labels: Record<MatchStatus, string> = {
    scheduled: "未开始",
    live: "进行中",
    paused: "中场",
    finished: "已结束",
    postponed: "延期",
    cancelled: "取消",
    unknown: "未知"
  };

  return labels[status];
}

