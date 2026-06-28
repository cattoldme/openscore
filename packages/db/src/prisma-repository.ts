import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Competition, CompetitionType, MatchStatus, MatchSummary, Sport, StandingRow, Team } from "@openscore/domain";
import type { MatchListQuery, SportsRepository } from "./repository.ts";

const DEFAULT_SPORT_ID = "football";

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when SPORTS_REPOSITORY=postgres.");
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl
  });

  return new PrismaClient({ adapter });
}

export function createPrismaSportsRepository(prisma: PrismaClient): SportsRepository {
  return {
    async upsertSports(items) {
      for (const item of items) {
        await upsertSport(prisma, item);
      }
    },
    async upsertCompetitions(items) {
      for (const item of items) {
        await ensureSport(prisma, item.sportId);
        await prisma.competition.upsert({
          where: { id: item.id },
          update: mapCompetitionWrite(item),
          create: {
            id: item.id,
            ...mapCompetitionWrite(item)
          }
        });
      }
    },
    async upsertMatches(items) {
      for (const item of items) {
        await ensureSport(prisma, item.sportId);
        await ensureCompetition(prisma, item.competitionId, item.sportId, item.competitionName);
        await ensureTeam(prisma, {
          id: item.homeTeamId,
          sportId: item.sportId,
          name: item.homeTeamName,
          shortName: item.homeTeamName,
          countryCode: "UN"
        });
        await ensureTeam(prisma, {
          id: item.awayTeamId,
          sportId: item.sportId,
          name: item.awayTeamName,
          shortName: item.awayTeamName,
          countryCode: "UN"
        });
        await prisma.match.upsert({
          where: { id: item.id },
          update: mapMatchWrite(item),
          create: {
            id: item.id,
            ...mapMatchWrite(item)
          }
        });
      }
    },
    async upsertStandings(competitionId, rows) {
      await ensureSport(prisma, DEFAULT_SPORT_ID);
      await ensureCompetition(prisma, competitionId, DEFAULT_SPORT_ID, competitionId);

      const seasonId = currentSeasonId(competitionId);
      await prisma.season.upsert({
        where: { id: seasonId },
        update: {
          current: true
        },
        create: {
          id: seasonId,
          competitionId,
          name: "Current",
          current: true
        }
      });

      for (const row of rows) {
        await ensureTeam(prisma, {
          id: row.teamId,
          sportId: DEFAULT_SPORT_ID,
          name: row.teamName,
          shortName: row.teamName,
          countryCode: "UN"
        });
        await prisma.standing.upsert({
          where: {
            competitionId_seasonId_teamId: {
              competitionId,
              seasonId,
              teamId: row.teamId
            }
          },
          update: mapStandingWrite(row),
          create: {
            competitionId,
            seasonId,
            teamId: row.teamId,
            ...mapStandingWrite(row)
          }
        });
      }
    },
    async upsertTeams(items) {
      for (const item of items) {
        await ensureTeam(prisma, item);
      }
    },
    async listSports() {
      const rows = await prisma.sport.findMany({
        orderBy: { name: "asc" }
      });

      return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name
      }));
    },
    async listCompetitions() {
      const rows = await prisma.competition.findMany({
        orderBy: { name: "asc" }
      });

      return rows.map(mapCompetitionRead);
    },
    async findCompetition(id) {
      const row = await prisma.competition.findUnique({
        where: { id }
      });

      return row ? mapCompetitionRead(row) : null;
    },
    async listMatches(query = {}) {
      const rows = await prisma.match.findMany({
        where: buildMatchWhere(query),
        include: {
          competition: true,
          homeTeam: true,
          awayTeam: true
        },
        orderBy: { startsAt: "asc" }
      });

      return rows.map(mapMatchRead);
    },
    async findMatch(id) {
      const row = await prisma.match.findUnique({
        where: { id },
        include: {
          competition: true,
          homeTeam: true,
          awayTeam: true
        }
      });

      return row ? mapMatchRead(row) : null;
    },
    async listStandings(competitionId) {
      const row = await prisma.season.findFirst({
        where: {
          competitionId,
          current: true
        },
        orderBy: { updatedAt: "desc" }
      });
      const seasonId = row?.id ?? currentSeasonId(competitionId);
      const rows = await prisma.standing.findMany({
        where: {
          competitionId,
          seasonId
        },
        include: {
          team: true
        },
        orderBy: { position: "asc" }
      });

      return rows.map((item) => ({
        teamId: item.teamId,
        teamName: item.team.name,
        position: item.position,
        played: item.played,
        won: item.won,
        drawn: item.drawn,
        lost: item.lost,
        goalsFor: item.goalsFor,
        goalsAgainst: item.goalsAgainst,
        goalDifference: item.goalDifference,
        points: item.points,
        form: parseForm(item.form)
      }));
    },
    async findTeam(id) {
      const row = await prisma.team.findUnique({
        where: { id }
      });

      return row
        ? {
            id: row.id,
            sportId: row.sportId,
            name: row.name,
            shortName: row.shortName,
            countryCode: row.countryCode ?? "UN",
            logoUrl: row.logoUrl ?? undefined
          }
        : null;
    },
    async listTeamForm(teamId) {
      const row = await prisma.standing.findFirst({
        where: { teamId },
        orderBy: { updatedAt: "desc" }
      });

      return parseForm(row?.form);
    },
    async snapshot() {
      const [sports, competitions, matches, standings, teams] = await Promise.all([
        prisma.sport.count(),
        prisma.competition.count(),
        prisma.match.count(),
        prisma.standing.count(),
        prisma.team.count()
      ]);

      return {
        sports,
        competitions,
        matches,
        standings,
        teams
      };
    }
  };
}

async function upsertSport(prisma: PrismaClient, item: Sport) {
  await prisma.sport.upsert({
    where: { id: item.id },
    update: {
      code: item.code,
      name: item.name
    },
    create: {
      id: item.id,
      code: item.code,
      name: item.name
    }
  });
}

async function ensureSport(prisma: PrismaClient, sportId: string) {
  await prisma.sport.upsert({
    where: { id: sportId },
    update: {},
    create: {
      id: sportId,
      code: sportId,
      name: sportId === "football" ? "足球" : sportId
    }
  });
}

async function ensureCompetition(prisma: PrismaClient, competitionId: string, sportId: string, name: string) {
  await prisma.competition.upsert({
    where: { id: competitionId },
    update: {},
    create: {
      id: competitionId,
      sportId,
      name,
      shortName: name,
      countryCode: "UN",
      type: "league"
    }
  });
}

async function ensureTeam(prisma: PrismaClient, team: Team) {
  await ensureSport(prisma, team.sportId);
  await prisma.team.upsert({
    where: { id: team.id },
    update: {
      name: team.name,
      shortName: team.shortName,
      countryCode: team.countryCode,
      logoUrl: team.logoUrl
    },
    create: {
      id: team.id,
      sportId: team.sportId,
      name: team.name,
      shortName: team.shortName,
      countryCode: team.countryCode,
      logoUrl: team.logoUrl
    }
  });
}

function mapCompetitionWrite(item: Competition) {
  return {
    sportId: item.sportId,
    name: item.name,
    shortName: item.shortName,
    countryCode: item.countryCode,
    type: item.type,
    logoUrl: item.logoUrl
  };
}

function mapMatchWrite(item: MatchSummary) {
  return {
    sportId: item.sportId,
    competitionId: item.competitionId,
    homeTeamId: item.homeTeamId,
    awayTeamId: item.awayTeamId,
    startsAt: new Date(item.startsAt),
    status: item.status,
    minute: item.minute,
    homeScore: item.homeScore,
    awayScore: item.awayScore
  };
}

function mapStandingWrite(row: StandingRow) {
  return {
    position: row.position,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
    form: row.form.join(",")
  };
}

function mapCompetitionRead(row: {
  id: string;
  sportId: string;
  name: string;
  shortName: string;
  countryCode: string | null;
  type: CompetitionType;
  logoUrl: string | null;
}): Competition {
  return {
    id: row.id,
    sportId: row.sportId,
    name: row.name,
    shortName: row.shortName,
    countryCode: row.countryCode ?? "UN",
    type: row.type,
    logoUrl: row.logoUrl ?? undefined
  };
}

function mapMatchRead(row: {
  id: string;
  sportId: string;
  competitionId: string;
  competition: { shortName: string; name: string };
  homeTeamId: string;
  homeTeam: { name: string };
  awayTeamId: string;
  awayTeam: { name: string };
  startsAt: Date;
  status: MatchStatus;
  minute: number | null;
  homeScore: number;
  awayScore: number;
  updatedAt: Date;
}): MatchSummary {
  return {
    id: row.id,
    sportId: row.sportId,
    competitionId: row.competitionId,
    competitionName: row.competition.shortName || row.competition.name,
    homeTeamId: row.homeTeamId,
    homeTeamName: row.homeTeam.name,
    awayTeamId: row.awayTeamId,
    awayTeamName: row.awayTeam.name,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    minute: row.minute ?? undefined,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    updatedAt: row.updatedAt.toISOString()
  };
}

function buildMatchWhere(query: MatchListQuery) {
  const where: { startsAt?: { gte: Date; lt: Date }; status?: MatchStatus } = {};

  if (query.date === "today") {
    const today = new Date().toISOString().slice(0, 10);
    where.startsAt = {
      gte: new Date(`${today}T00:00:00.000Z`),
      lt: new Date(`${today}T23:59:59.999Z`)
    };
  }

  if (query.status) {
    where.status = query.status as MatchStatus;
  }

  return where;
}

function parseForm(form?: string | null): Array<"W" | "D" | "L"> {
  return (form ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is "W" | "D" | "L" => item === "W" || item === "D" || item === "L");
}

function currentSeasonId(competitionId: string) {
  return `${competitionId}:current`;
}
