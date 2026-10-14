import { Redis } from "ioredis";
import { requiredEnv } from "../utils/env.js";

const redisUrl = new URL(requiredEnv("REDIS_URL"));
// Plain options avoid coupling BullMQ to a different installed ioredis class.
export const redisConnection = {
    host: redisUrl.hostname.replace(/^\[|\]$/g, ""),
    port: Number(redisUrl.port || 6379),
    username: decodeURIComponent(redisUrl.username) || undefined,
    password: decodeURIComponent(redisUrl.password) || undefined,
    db: Number(redisUrl.pathname.slice(1) || 0),
    maxRetriesPerRequest: null,
    ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
};
export const client = new Redis(redisConnection);
client.on("error", err => console.log("Redis Client Error", err.message));
client.on("connect", () => console.log("✅ Redis client connected"));
