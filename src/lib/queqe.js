import { Queue } from "bullmq";
import { client } from "./redis.js";

export const emailQueue = new Queue("email-queue", { connection: client });