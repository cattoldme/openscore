import type { ProviderCode } from "@openscore/domain";
import { createFootballDataProvider } from "./football-data";
import { createMockProvider } from "./mock";
import type { SportsDataProvider, SportsDataProviderOptions } from "./types";

export type {
  AiQueryResult,
  FixtureQuery,
  FootballDataProviderOptions,
  SportsDataProvider,
  SportsDataProviderOptions,
  StandingQuery,
  TeamQuery
} from "./types";
export {
  findCompetitionById,
  findMatchById,
  findTeamById,
  getCompetitionStandings,
  getLiveMatches,
  getMatchList,
  getTeamForm,
  mockCompetitions,
  mockMatches,
  mockSports,
  mockStandings,
  mockTeams
} from "./mock";

export function createSportsDataProvider(
  code: ProviderCode = "mock",
  options: SportsDataProviderOptions = {}
): SportsDataProvider {
  if (code === "mock") {
    return createMockProvider();
  }

  if (code === "football_data") {
    return createFootballDataProvider(options.footballData);
  }

  throw new Error(`Sports data provider is not implemented yet: ${code}`);
}
