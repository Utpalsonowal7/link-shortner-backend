import { Redis } from "ioredis";


export const client = new Redis(process.env.REDIS_URL, {
     maxRetriesPerRequest: null,
});

client.on('error', err => console.log('Redis Client Error', err));

client.on('connect', () => console.log('✅ Redis client connected'));