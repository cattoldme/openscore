import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WEB_PUBLIC_BASE_URL: z.url().default("http://localhost:3000"),
  API_BASE_URL: z.url().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1).default("postgresql://openscore:openscore@localhost:5432/openscore?schema=public"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  CACHE_PROVIDER: z.enum(["memory", "redis"]).default("memory"),
  SPORTS_REPOSITORY: z.enum(["memory", "postgres"]).default("memory"),
  SPORTS_PROVIDER: z.enum(["mock", "football_data", "thesportsdb", "openligadb", "openfootball"]).default("mock"),
  FOOTBALL_DATA_API_KEY: z.string().optional().default(""),
  FOOTBALL_DATA_BASE_URL: z.url().default("https://api.football-data.org/v4"),
  FOOTBALL_DATA_COMPETITIONS: z.string().default("PL"),
  THESPORTSDB_API_KEY: z.string().optional().default(""),
  OPENLIGADB_BASE_URL: z.url().default("https://www.openligadb.de/api"),
  AI_PROVIDER: z.enum(["disabled", "openai"]).default("disabled"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_BASE_URL: z.url().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().optional().default(""),
  LIVE_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  FIXTURE_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15)
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}
