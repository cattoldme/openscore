import type { Competition, MatchSummary, ProviderCode, Sport, StandingRow, Team } from "@openscore/domain";

export type FixtureQuery = {
  date?: "today";
  status?: string;
};

export type StandingQuery = {
  competitionId: string;
};

export type TeamQuery = {
  teamId: string;
};

export type AiQueryResult = {
  query: string;
  answer: string;
  cards: MatchSummary[];
  grounded: boolean;
};

export type SportsDataProvider = {
  code: ProviderCode;
  fetchSports(): Promise<Sport[]>;
  fetchCompetitions(): Promise<Competition[]>;
  fetchFixtures(input?: FixtureQuery): Promise<MatchSummary[]>;
  fetchLiveScores(): Promise<MatchSummary[]>;
  fetchStandings(input: StandingQuery): Promise<StandingRow[]>;
  fetchTeam(input: TeamQuery): Promise<Team | null>;
  fetchTeamForm(input: TeamQuery): Promise<Array<"W" | "D" | "L">>;
  answerQuery(query: string): Promise<AiQueryResult>;
};

