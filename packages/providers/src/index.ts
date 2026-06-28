import type { ProviderCode } from "@openscore/domain";
import { createMockProvider } from "./mock";
import type { SportsDataProvider } from "./types";

export type { AiQueryResult, FixtureQuery, SportsDataProvider, StandingQuery, TeamQuery } from "./types";
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

export function createSportsDataProvider(code: ProviderCode = "mock"): SportsDataProvider {
  if (code === "mock") {
    return createMockProvider();
  }

  throw new Error(`Sports data provider is not implemented yet: ${code}`);
}

