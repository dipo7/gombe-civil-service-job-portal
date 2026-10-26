import IORedis from "ioredis";
import { env } from "./env";

const globalForRedis = globalThis as unknown as { redis?: IORedis };

/** Shared connection for the web app (rate limiting, queue producer). */
export function redis(): IORedis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new IORedis(env().REDIS_URL, { maxRetriesPerRequest: null });
  }
  return globalForRedis.redis;
}
