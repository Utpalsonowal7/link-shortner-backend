import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";
import type { EmailJobData } from "../types/index.js";

export const emailQueue = new Queue<EmailJobData, unknown, string>("email-queue", { connection: redisConnection });
