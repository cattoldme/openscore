export const prismaSchemaPath = "packages/db/prisma/schema.prisma";

export { createPrismaClient, createPrismaSportsRepository } from "./prisma-repository.ts";
export type { MatchListQuery, RepositorySnapshot, SportsRepository } from "./repository.ts";
export { createInMemorySportsRepository } from "./repository.ts";
