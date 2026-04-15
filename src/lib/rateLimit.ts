import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create a new ratelimiter, that allows 5 requests per 1 minute
// Note: We use a fallback if UPSTASH_REDIS_REST_URL is missing to avoid crashing in dev
// if environment variables aren't set perfectly, but it should be set in prod.
export const extractionRateLimit = new Ratelimit({
  redis: process.env.UPSTASH_REDIS_REST_URL
    ? Redis.fromEnv()
    : new Redis({ url: "https://localhost", token: "placeholder" }), // Dummy for type safety if missing env
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit:extraction",
});

export const loginRateLimit = new Ratelimit({
  redis: process.env.UPSTASH_REDIS_REST_URL
    ? Redis.fromEnv()
    : new Redis({ url: "https://localhost", token: "placeholder" }),
  limiter: Ratelimit.slidingWindow(10, "5 m"),
  analytics: true,
  prefix: "@upstash/ratelimit:login",
});
