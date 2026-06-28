import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dryRun = process.argv.includes("--dry-run");
const today = new Date().toISOString().slice(0, 10);
const seasonId = "premier-league:current";

const sports = [
  {
    id: "football",
    code: "football",
    name: "足球"
  }
];

const competitions = [
  {
    id: "premier-league",
    sportId: "football",
    name: "英格兰超级联赛",
    shortName: "英超",
    countryCode: "GB",
    type: "league"
  }
];

const teams = [
  { id: "arsenal", sportId: "football", name: "阿森纳", shortName: "ARS", countryCode: "GB" },
  { id: "man-city", sportId: "football", name: "曼城", shortName: "MCI", countryCode: "GB" },
  { id: "liverpool", sportId: "football", name: "利物浦", shortName: "LIV", countryCode: "GB" },
  { id: "chelsea", sportId: "football", name: "切尔西", shortName: "CHE", countryCode: "GB" },
  { id: "tottenham", sportId: "football", name: "热刺", shortName: "TOT", countryCode: "GB" },
  { id: "man-united", sportId: "football", name: "曼联", shortName: "MUN", countryCode: "GB" }
];

const matches = [
  match("match-001", "arsenal", "chelsea", `${today}T11:30:00.000Z`, "live", 63, 2, 1),
  match("match-002", "man-city", "tottenham", `${today}T14:00:00.000Z`, "scheduled", null, 0, 0),
  match("match-003", "liverpool", "man-united", `${today}T16:30:00.000Z`, "scheduled", null, 0, 0),
  match("match-004", "chelsea", "tottenham", `${today}T08:00:00.000Z`, "finished", 90, 1, 1)
];

const standings = [
  standing("arsenal", 1, 20, 14, 4, 2, 43, 19, ["W", "W", "D", "W", "L"]),
  standing("man-city", 2, 20, 13, 5, 2, 46, 21, ["W", "D", "W", "W", "W"]),
  standing("liverpool", 3, 20, 12, 5, 3, 41, 22, ["D", "W", "L", "W", "D"]),
  standing("chelsea", 4, 20, 10, 6, 4, 36, 24, ["D", "W", "W", "L", "W"]),
  standing("tottenham", 5, 20, 9, 5, 6, 34, 29, ["L", "D", "W", "L", "W"]),
  standing("man-united", 6, 20, 8, 4, 8, 30, 30, ["W", "L", "D", "L", "W"])
];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        sports: sports.length,
        competitions: competitions.length,
        seasons: 1,
        teams: teams.length,
        matches: matches.length,
        standings: standings.length,
        providerSources: 1
      },
      null,
      2
    )
  );
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for pnpm db:seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl
  })
});

try {
  await seed();
  console.log("OpenScore database seed completed.");
} finally {
  await prisma.$disconnect();
}

async function seed() {
  await prisma.providerSource.upsert({
    where: { code: "mock" },
    update: {
      name: "OpenScore Mock Provider",
      baseUrl: null,
      enabled: true
    },
    create: {
      id: "provider:mock",
      code: "mock",
      name: "OpenScore Mock Provider",
      enabled: true
    }
  });

  for (const item of sports) {
    await prisma.sport.upsert({
      where: { id: item.id },
      update: {
        code: item.code,
        name: item.name
      },
      create: item
    });
  }

  for (const item of competitions) {
    await prisma.competition.upsert({
      where: { id: item.id },
      update: {
        sportId: item.sportId,
        name: item.name,
        shortName: item.shortName,
        countryCode: item.countryCode,
        type: item.type
      },
      create: item
    });
  }

  await prisma.season.upsert({
    where: { id: seasonId },
    update: {
      name: "Current",
      current: true
    },
    create: {
      id: seasonId,
      competitionId: "premier-league",
      name: "Current",
      current: true
    }
  });

  for (const item of teams) {
    await prisma.team.upsert({
      where: { id: item.id },
      update: {
        sportId: item.sportId,
        name: item.name,
        shortName: item.shortName,
        countryCode: item.countryCode
      },
      create: item
    });
  }

  for (const item of matches) {
    await prisma.match.upsert({
      where: { id: item.id },
      update: {
        sportId: item.sportId,
        competitionId: item.competitionId,
        seasonId: item.seasonId,
        homeTeamId: item.homeTeamId,
        awayTeamId: item.awayTeamId,
        startsAt: item.startsAt,
        status: item.status,
        minute: item.minute,
        homeScore: item.homeScore,
        awayScore: item.awayScore
      },
      create: item
    });
  }

  for (const item of standings) {
    await prisma.standing.upsert({
      where: {
        competitionId_seasonId_teamId: {
          competitionId: item.competitionId,
          seasonId: item.seasonId,
          teamId: item.teamId
        }
      },
      update: {
        position: item.position,
        played: item.played,
        won: item.won,
        drawn: item.drawn,
        lost: item.lost,
        goalsFor: item.goalsFor,
        goalsAgainst: item.goalsAgainst,
        goalDifference: item.goalDifference,
        points: item.points,
        form: item.form
      },
      create: item
    });
  }
}

function match(id, homeTeamId, awayTeamId, startsAt, status, minute, homeScore, awayScore) {
  return {
    id,
    sportId: "football",
    competitionId: "premier-league",
    seasonId,
    homeTeamId,
    awayTeamId,
    startsAt: new Date(startsAt),
    status,
    minute,
    homeScore,
    awayScore
  };
}

function standing(teamId, position, played, won, drawn, lost, goalsFor, goalsAgainst, form) {
  return {
    competitionId: "premier-league",
    seasonId,
    teamId,
    position,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: won * 3 + drawn,
    form: form.join(",")
  };
}
