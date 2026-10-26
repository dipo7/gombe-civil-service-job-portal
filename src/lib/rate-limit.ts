import { redis } from "./redis";

/** Fixed-window limiter. Fails open if Redis is unavailable. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const k = `rl:${key}`;
    const count = await redis().incr(k);
    if (count === 1) await redis().expire(k, windowSeconds);
    return count <= limit;
  } catch {
    return true;
  }
}
